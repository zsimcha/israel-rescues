import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// Get the Resend API Key from Supabase Secrets
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

serve(async (req) => {
  try {
    // Parse the webhook payload coming from Supabase
    const payload = await req.json()
    const record = payload.record

    // Format the email HTML based on whether it's a waitlist or normal booking
    const isWaitlist = record.payment_status === 'waitlist'
    const statusText = isWaitlist ? "ACTION REQUIRED: WAITLIST SPOT HELD (AWAITING WIRE)" : "ACTION REQUIRED: RESERVATION HELD (AWAITING WIRE)"
    const seatLabel = isWaitlist ? "Waitlist Spots" : "Seats Reserved"

    const htmlContent = `
      <div style='font-family: Arial, sans-serif; background-color: #f4f4f5; margin: 0; padding: 20px; color: #333;'>
        <div style='max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);'>
          <div style='background-color: #0a192f; color: #ffffff; padding: 30px 20px; text-align: center;'>
            <h1 style='margin: 0; font-size: 24px; letter-spacing: 1px;'>ISRAEL RESCUES</h1>
            <p style='margin: 5px 0 0 0; color: #94a3b8; font-size: 14px;'>Charter Flight Reservation</p>
          </div>
          <div style='padding: 30px 20px;'>
            <div style='display: inline-block; background-color: #fef3c7; color: #b45309; padding: 8px 16px; border-radius: 4px; font-weight: bold; font-size: 14px; margin-bottom: 20px; border: 1px solid #fde68a;'>
              ${statusText}
            </div>
            <p>Dear ${record.contact_name},</p>
            <p>Your request for the emergency charter flight from Tel Aviv to Frankfurt has been received.</p>
            <div style='background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px; font-size: 14px; line-height: 1.5; color: #1e3a8a; margin-bottom: 20px;'>
              <strong>Wire Instructions:</strong><br>
              To confirm your spot, payment must be initiated via bank wire within <strong>6 hours</strong> of receiving this email.<br><br>
              <strong>Bank Name:</strong> [INSERT BANK NAME HERE]<br>
              <strong>Account Name:</strong> Rescue Charters LLC<br>
              <strong>Account Number:</strong> [INSERT ACCOUNT NUMBER HERE]<br>
              <strong>Routing / Swift:</strong> [INSERT ROUTING HERE]<br>
              <strong>Memo/Reference:</strong> MUST INCLUDE "${record.booking_ref}"<br><br>
              <em>Total Due: $${record.total_paid}</em>
            </div>
            <div style='background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 20px; margin-bottom: 20px;'>
              <p><strong>Booking Reference:</strong> <span style='color: #2563eb; font-size: 18px;'>${record.booking_ref}</span></p>
              <p><strong>${seatLabel}:</strong> ${record.passenger_count} x ${record.cabin_class.toUpperCase()}</p>
            </div>
            <p style='font-size: 14px; color: #475569; margin-top: 30px;'>
              Stay safe,<br>
              <strong>The Israel Rescues Team</strong><br>
              <a href='mailto:Help@IsraelRescues.com'>Help@IsraelRescues.com</a>
            </p>
          </div>
        </div>
      </div>
    `

    // Call Resend API
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: 'Help@IsraelRescues.com',
        to: record.email,
        subject: `Israel Rescues: Action Required for Ref ${record.booking_ref}`,
        html: htmlContent
      })
    })

    const responseData = await res.json()
    return new Response(JSON.stringify(responseData), { headers: { "Content-Type": "application/json" } })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json" } })
  }
})