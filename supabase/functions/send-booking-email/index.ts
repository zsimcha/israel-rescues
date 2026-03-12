import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const WEBHOOK_SECRET = Deno.env.get('WEBHOOK_SECRET') ?? ''; 
const ADMIN_EMAIL = 'Help@israelrescues.com';

if (!RESEND_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing required env variables.");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  global: { headers: { 'x-my-app': 'israel-rescues' } }
});

function escapeHtml(s: unknown) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

async function verifySecret(req: Request) {
  if (!WEBHOOK_SECRET) return true;
  const header = req.headers.get('x-webhook-secret') || req.headers.get('x-supabase-signature');
  return header === WEBHOOK_SECRET;
}

serve(async (req: Request) => {
  try {
    if (!(await verifySecret(req))) {
      console.warn('Webhook secret verification failed');
      return new Response("Unauthorized", { status: 401 });
    }

    const payload = await req.json().catch(() => null);
    if (!payload) return new Response("No payload", { status: 400 });

    const { type, record, old_record } = payload as any;
    if (!record || typeof record !== 'object' || !record.email) {
      console.log("Ignoring webhook - missing record/email");
      return new Response("Ignored", { status: 200 });
    }

    const bookingId = record.id;
    if (bookingId) {
      const { data: already, error: alreadyErr } = await supabase
        .from('emails_sent')
        .select('id')
        .eq('booking_id', bookingId)
        .eq('event_type', type)
        .limit(1)
        .maybeSingle();

      if (alreadyErr) console.error("emails_sent lookup error:", alreadyErr);
      if (already) {
        console.log("Email already sent for booking id:", bookingId, "event:", type);
        return new Response("Already sent", { status: 200 });
      }
    }

    const contactName = String(record.contact_name || record.name || '').trim();
    let lastName = 'Guest';
    if (contactName) {
      const parts = contactName.split(/\s+/).filter(Boolean);
      lastName = parts.length > 0 ? parts[parts.length - 1] : contactName;
    }
    lastName = escapeHtml(lastName);

    const bookingRef = escapeHtml(record.booking_ref ?? record.ref ?? 'N/A');
    const passengerCount = Number(record.passenger_count ?? 1);
    const cabinClass = escapeHtml(record.cabin_class ?? 'economy');
    const totalDue = Number(record.total_due ?? record.total_amount ?? 0);
    const totalPaid = Number(record.total_paid ?? 0);

    async function sendEmail(to: string[], subject: string, html: string) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${RESEND_API_KEY}`
        },
        body: JSON.stringify({
          from: 'Israel Rescues <Help@israelrescues.com>',
          to,
          subject,
          html
        })
      });
      const json = await res.json().catch(() => ({ ok: false, status: res.status }));
      if (!res.ok) {
        console.error('Resend error', res.status, json);
        throw new Error(`Email send failed: ${res.status}`);
      }
      return json;
    }

    // Shared legal and timing footer for all emails
    const legalFooterHtml = `
      <div style='margin-top: 30px; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 15px; line-height: 1.5;'>
        <p><strong>Flight Confirmation & Security:</strong> Due to the regional security situation, the exact departure date and time are subject to change but will be confirmed 48 to 72 hours before departure. We strongly recommend waiting until final confirmation to book onward flights.</p>
        <p><strong>Refund Policy:</strong> All ticket purchases are fully refundable if the charter flight does not operate, with refunds issued within 30 business days (less applicable processing fees).</p>
        <p><strong>Liability Disclaimer:</strong> Rescue Charters LLC acts solely as an independent coordinator. We are not responsible or liable for any delays, cancellations, missed connections, or any direct, indirect, incidental, or consequential damages resulting from the operation or non-operation of this flight.</p>
      </div>
    `;

    let subject = '';
    let htmlContent = '';

    if (type === 'INSERT') {
      const isWaitlist = record.payment_status === 'waitlist';
      const statusText = isWaitlist ? "ACTION REQUIRED: WAITLIST SPOT HELD (AWAITING WIRE)" : "ACTION REQUIRED: RESERVATION HELD (AWAITING WIRE)";
      const seatLabel = isWaitlist ? "Waitlist Spots" : "Seats Reserved";

      subject = `Israel Rescues: Action Required for Ref ${bookingRef}`;
      htmlContent = `
        <div style='font-family: Arial, sans-serif; background-color: #f4f4f5; margin: 0; padding: 20px; color: #333;'>
          <div style='max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);'>
            <div style='background-color: #0a192f; color: #ffffff; padding: 30px 20px; text-align: center;'>
              <h1 style='margin: 0; font-size: 24px; letter-spacing: 1px;'>ISRAEL RESCUES</h1>
              <p style='margin: 5px 0 0 0; color: #94a3b8; font-size: 14px;'>Charter Flight Reservation</p>
            </div>
            <div style='padding: 30px 20px;'>
              <div style='display: inline-block; background-color: #fef3c7; color: #b45309; padding: 8px 16px; border-radius: 4px; font-weight: bold; font-size: 14px; margin-bottom: 20px; border: 1px solid #fde68a;'>
                ${escapeHtml(statusText)}
              </div>
              <p>Dear ${escapeHtml(contactName)},</p>
              <p>Your request for the emergency charter flight from Tel Aviv to Frankfurt has been received.</p>
              <div style='background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px; font-size: 14px; line-height: 1.5; color: #1e3a8a; margin-bottom: 20px;'>
                <strong>Wire Instructions:</strong><br>
                To confirm your spot, payment must be initiated via bank wire within <strong>6 hours</strong>.<br><br>
                <strong>Bank Name:</strong> Coastal Community Bank (5415 Evergreen Way, Everett, WA 98203)<br>
                <strong>Account Name:</strong> Rescue Charters LLC<br>
                <strong>Account Number:</strong> 875110492670<br>
                <strong>Routing Number:</strong> 125109019<br>
                <strong>Memo/Reference:</strong> MUST INCLUDE "${lastName} - ${bookingRef}"<br><br>
                <em>Total Due: $${totalDue.toLocaleString()}</em><br><br>
                <span style="color: #b45309; font-weight: bold;">IMPORTANT:</span> After sending your wire, please email the confirmation receipt to <a href="mailto:help@israelrescues.com">help@israelrescues.com</a> and include your booking number (${bookingRef}).
              </div>
              <div style='background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 20px; margin-bottom: 20px;'>
                <p><strong>Booking Reference:</strong> <span style='color: #2563eb; font-size: 18px;'>${bookingRef}</span></p>
                <p><strong>${seatLabel}:</strong> ${passengerCount} x ${cabinClass.toUpperCase()}</p>
              </div>
              
              ${legalFooterHtml}
            </div>
          </div>
        </div>
      `;
    } else if (type === 'UPDATE' && record.payment_status === 'confirmed' && old_record?.payment_status !== 'confirmed') {
      subject = `Israel Rescues: E-Ticket & Receipt (Ref: ${bookingRef})`;
      
      let passengerHtml = '';
      try {
        const { data: passengers } = await supabase
          .from('passengers')
          .select('first_name, middle_name, last_name, passport_number')
          .eq('booking_id', bookingId);

        if (passengers && passengers.length) {
          passengerHtml = `<div style='background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 20px; margin-bottom: 20px;'><h3 style="margin-top: 0; color: #0a192f; font-size: 16px; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px;">Passenger Manifest</h3><ul style="font-size: 14px; color: #475569; line-height: 1.6; padding-left: 20px; margin-bottom: 0;">`;
          for (const p of passengers) {
            const name = `${escapeHtml(p.first_name)} ${escapeHtml(p.middle_name || '')} ${escapeHtml(p.last_name)}`.replace(/\s+/g, ' ').trim();
            passengerHtml += `<li style="margin-bottom: 5px;"><strong>${name}</strong> (Passport: ${escapeHtml(p.passport_number)})</li>`;
          }
          passengerHtml += '</ul></div>';
        }
      } catch (e) {
        console.error("Failed to fetch passengers for receipt", e);
      }

      htmlContent = `
        <div style='font-family: Arial, sans-serif; background-color: #f4f4f5; margin: 0; padding: 20px; color: #333;'>
          <div style='max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);'>
            <div style='background-color: #0a192f; color: #ffffff; padding: 30px 20px; text-align: center;'>
              <h1 style='margin: 0; font-size: 24px; letter-spacing: 1px;'>ISRAEL RESCUES</h1>
              <p style='margin: 5px 0 0 0; color: #94a3b8; font-size: 14px;'>Official E-Ticket & Receipt</p>
            </div>
            <div style='padding: 30px 20px;'>
              <div style='display: inline-block; background-color: #dcfce7; color: #166534; padding: 8px 16px; border-radius: 4px; font-weight: bold; font-size: 14px; margin-bottom: 20px; border: 1px solid #bbf7d0;'>
                ✅ BOOKING CONFIRMED & PAID
              </div>
              <p>Dear ${escapeHtml(contactName)},</p>
              <p>We have successfully received your wire transfer. Your seats are <strong>fully confirmed</strong>.</p>
              <div style='background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 20px; margin-bottom: 20px;'>
                <p><strong>Route:</strong> Tel Aviv (TLV) ✈ Frankfurt (FRA)</p>
                <p><strong>Target Departure:</strong> March 18</p>
                <p><strong>Seats Confirmed:</strong> ${passengerCount} x ${cabinClass.toUpperCase()}</p>
                <p><strong>Booking Reference:</strong> <span style='color: #2563eb; font-size: 18px;'>${bookingRef}</span></p>
              </div>
              ${passengerHtml}
              <div style='background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 20px; margin-bottom: 20px;'>
                <p><strong>Total Paid:</strong> $${totalPaid.toLocaleString()}</p>
                <p><strong>Status:</strong> Paid in Full</p>
              </div>
              
              ${legalFooterHtml}
            </div>
          </div>
        </div>
      `;
    } else {
      console.log('Webhook event ignored:', type);
      return new Response("Ignored", { status: 200 });
    }

    try {
      // 1. Send email to the customer
      const result = await sendEmail([record.email], subject, htmlContent);

      // 2. Mark email as sent in DB
      if (bookingId) {
        await supabase.from('emails_sent').insert([{
          booking_id: bookingId,
          event_type: type,
          provider: 'resend',
          provider_response: result,
          sent_at: new Date().toISOString()
        }]);
      }

      // 3. Send Notification to Admin (Only on New Bookings / INSERT)
      if (type === 'INSERT') {
        const adminHtml = `
          <div style="font-family: sans-serif; color: #1e293b;">
            <h2>🚨 New Booking Received</h2>
            <p><strong>Booking Ref:</strong> ${bookingRef}</p>
            <p><strong>Status:</strong> ${escapeHtml(record.payment_status)}</p>
            <p><strong>Name:</strong> ${escapeHtml(contactName)}</p>
            <p><strong>Email:</strong> ${escapeHtml(record.email)}</p>
            <p><strong>Phone:</strong> ${escapeHtml(record.phone)}</p>
            <p><strong>Class:</strong> ${cabinClass}</p>
            <p><strong>Passengers:</strong> ${passengerCount}</p>
            <p><strong>Total Due:</strong> $${totalDue.toLocaleString()}</p>
            <br/>
            <p><em>Check the Supabase dashboard to verify wire receipt.</em></p>
          </div>
        `;
        // Fire and forget the admin email so it doesn't fail the main request if it drops
        sendEmail([ADMIN_EMAIL], `New Booking Alert - ${bookingRef} - $${totalDue}`, adminHtml)
          .catch(e => console.error("Admin notification email failed:", e));
      }

      return new Response(JSON.stringify({ ok: true, provider: 'resend', result }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } catch (err) {
      console.error('Send email failure:', err);
      return new Response("Email send failed", { status: 500 });
    }
  } catch (err) {
    console.error('Function error:', err);
    return new Response("Internal Server Error", { status: 500 });
  }
});