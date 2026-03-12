import React, { useState, useEffect } from 'react';
import { Plane, ShieldCheck, Clock, Users, ChevronRight, CheckCircle, CreditCard, Lock, AlertCircle, Landmark, HelpCircle, FileText, Check, ChevronDown, ChevronUp, MapPin, Search } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { Analytics } from '@vercel/analytics/react';

// --- SUPABASE INITIALIZATION ---
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const ADMIN_PIN = import.meta.env.VITE_ADMIN_PIN || '0000'; 

const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;

// --- CONSTANTS & CONFIG ---
const FLIGHT_INFO = {
  routeMain: 'Tel Aviv (TLV) to Frankfurt (FRA)',
  routeSub: 'Direct Charter Flight',
  dateMain: 'March 18',
  dateSub: 'Exact time confirmed 48-72 hours prior',
  operator: 'Operated by a licensed carrier arranged through Chapman Freeborn',
  aircraft: 'Airbus A340-300 (widebody) — 38 Business seats + 215 Economy seats',
  totalSeats: 253
};

const CABIN_CLASSES = {
  economy: { id: 'economy', dbPrefix: 'eco', capacity: 136, name: 'Economy Class', price: 1950, features: ['Standard seating', '1x20kg checked bag + carry-on', 'Hot kosher meals included'], color: 'bg-slate-600' },
  premium: { id: 'premium', dbPrefix: 'prem', capacity: 79, name: 'Economy+', price: 2150, features: ['Front section seating & priority boarding', '1x20kg checked bag + carry-on', 'Hot kosher meals included'], color: 'bg-indigo-600' },
  business: { id: 'business', dbPrefix: 'biz', capacity: 38, name: 'Business', price: 3750, features: ['150-160° angled recline seats', 'Very spacious & comfortable', 'Priority boarding & premium service', '2x20kg checked bags + carry-on', 'Hot kosher meals included'], color: 'bg-blue-900' }
};

const COUNTRY_CODES = [
  { code: '+1', label: 'US/CA (+1)' }, { code: '+972', label: 'IL (+972)' }, { code: '+44', label: 'UK (+44)' },
  { code: '+33', label: 'FR (+33)' }, { code: '+49', label: 'DE (+49)' }, { code: '+61', label: 'AU (+61)' }, { code: '+00', label: 'Other' }
];

const formatPhoneNumber = (value) => {
  if (!value) return value;
  const phoneNumber = value.replace(/[^\d]/g, '');
  const phoneNumberLength = phoneNumber.length;
  if (phoneNumberLength < 4) return phoneNumber;
  if (phoneNumberLength < 7) {
    return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`;
  }
  return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`;
};

export default function App() {
  const [user, setUser] = useState(null);
  const [authInitialized, setAuthInitialized] = useState(false);
  
  const [view, setViewState] = useState(() => {
    const hash = window.location.hash.replace('#', '');
    return ['landing', 'booking', 'lookup', 'admin'].includes(hash) ? hash : 'landing';
  });

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      const validView = ['landing', 'booking', 'lookup', 'admin'].includes(hash) ? hash : 'landing';
      setViewState(validView);
      window.scrollTo(0, 0); 
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const setView = (newView) => { window.location.hash = newView; };

  const [selectedCabin, setSelectedCabin] = useState('economy');
  const [flightStatus, setFlightStatus] = useState({ 
    eco_remaining: 136, prem_remaining: 79, biz_remaining: 38,
    eco_reserved: 0, prem_reserved: 0, biz_reserved: 0 
  });
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setAuthInitialized(true);
      setLoadingData(false);
      return;
    }
    const initAuth = async () => {
      const { data, error } = await supabase.auth.signInAnonymously();
      if (!error) setUser(data?.user ?? data);
      setAuthInitialized(true);
    };
    initAuth();
  }, []);

  useEffect(() => {
    if (!supabase || !user) return;
    let channel;
    const fetchInitialCount = async () => {
      const { data, error } = await supabase.from('flight_status').select('*').eq('id', 1).single();
      if (!error && data) setFlightStatus(data);
      setLoadingData(false);
    };
    fetchInitialCount();

    channel = supabase.channel('status_updates')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'flight_status' }, payload => {
        setFlightStatus(payload.new);
      })
      .subscribe();

    return () => { if (channel) supabase.removeChannel(channel); };
  }, [user]);

  const handleSelectCabin = (cabinId) => {
    setSelectedCabin(cabinId);
    setView('booking');
  };

  if (!authInitialized || loadingData) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div></div>;
  if (!supabase) return <div className="min-h-screen flex items-center justify-center">Missing Supabase config.</div>;

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-blue-100 flex flex-col">
      <Navbar setView={setView} />
      <main className="flex-grow">
        {view === 'landing' && <LandingView onSelectCabin={handleSelectCabin} flightStatus={flightStatus} />}
        {view === 'booking' && <BookingFlow setView={setView} selectedCabin={selectedCabin} user={user} supabase={supabase} flightStatus={flightStatus} />}
        {view === 'lookup' && <LookupView setView={setView} supabase={supabase} />}
        {view === 'admin' && <AdminView setView={setView} flightStatus={flightStatus} />}
      </main>
      <Footer setView={setView} />
      <Analytics />
    </div>
  );
}

function Navbar({ setView }) {
  return (
    <nav className="bg-[#0a192f] text-white sticky top-0 z-50 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView('landing')}>
            <Plane className="h-6 w-6 text-blue-400" />
            <span className="font-bold text-xl tracking-tight">Israel Rescues</span>
          </div>
          <div className="flex items-center gap-6">
            <button onClick={() => setView('lookup')} className="text-sm font-medium text-slate-300 hover:text-white transition-colors flex items-center gap-1">
              <Search size={16}/> Find Reservation
            </button>
            <div className="text-sm font-medium text-slate-300 hidden sm:block">
              Help@IsraelRescues.com
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}

function LandingView({ onSelectCabin, flightStatus }) {
  const [openFaq, setOpenFaq] = useState(null);
  const toggleFaq = (index) => setOpenFaq(openFaq === index ? null : index);

  const totalRemaining = flightStatus.eco_remaining + flightStatus.prem_remaining + flightStatus.biz_remaining;
  const isCompletelyFull = totalRemaining <= 0;
  const isPartiallyFull = flightStatus.eco_remaining <= 0 || flightStatus.prem_remaining <= 0 || flightStatus.biz_remaining <= 0;

  const faqs = [
    { q: "When will the final flight details be confirmed?", a: "Due to the regional security situation, the exact departure date and time are subject to change. Final operational details and departure schedules will be confirmed 48 to 72 hours prior to departure. Passengers will receive full flight information at that time." },
    { q: "Can I get a refund?", a: "All ticket purchases are fully refundable if the charter flight does not operate. In such a case, passengers will receive a full refund of the ticket price within 30 business days, less any non-refundable payment processing fees charged by the provider (typically ~3%)." },
    { q: "Will families sit together?", a: "Yes. We will make every effort to seat all passengers on the same reservation together. If you have a special seating requirement, please contact us at Help@IsraelRescues.com and we will do our best to accommodate." },
    { q: "What happens if I join the waitlist?", a: "If the primary flight is full, you can join the priority waitlist. If the waitlist reaches sufficient capacity, we will endeavor to charter an additional flight. You must complete the wire transfer to secure your spot on the waitlist. If a second flight is not chartered, you will receive a full refund." }
  ];

  return (
    <div className="animate-in fade-in duration-500 pb-16">
      <div className="relative bg-[#0a192f] text-white py-16 sm:py-20 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img src="https://images.unsplash.com/photo-1540962351504-03099e0a754b?q=80&w=2000&auto=format&fit=crop" alt="Widebody Aircraft" className="w-full h-full object-cover opacity-25"/>
          <div className="absolute inset-0 bg-gradient-to-r from-[#0a192f] via-[#0a192f]/80 to-transparent"></div>
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-500/30 text-blue-200 text-sm font-medium mb-6">
            <Plane size={16} /> Emergency Charter Flight
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight mb-4 max-w-3xl">
            Israel to Frankfurt <br className="hidden sm:block"/> Charter Flight
          </h1>
          <p className="text-lg sm:text-xl text-slate-300 max-w-2xl mb-8 leading-relaxed">
            {FLIGHT_INFO.operator}. Direct charter flight providing immediate outbound travel.
          </p>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 max-w-4xl">
            <div className="bg-white/10 p-4 rounded-lg border border-white/20 backdrop-blur-md">
              <p className="text-slate-300 text-sm mb-1">Departure</p>
              <p className="font-semibold text-lg">{FLIGHT_INFO.dateMain}</p>
              <p className="text-xs text-slate-400 mt-0.5">{FLIGHT_INFO.dateSub}</p>
            </div>
            <div className="bg-white/10 p-4 rounded-lg border border-white/20 backdrop-blur-md">
              <p className="text-slate-300 text-sm mb-1">Route</p>
              <p className="font-semibold text-lg">{FLIGHT_INFO.routeMain}</p>
              <p className="text-xs text-slate-400 mt-0.5">{FLIGHT_INFO.routeSub}</p>
            </div>
            <div className="bg-white/10 p-4 rounded-lg border border-white/20 backdrop-blur-md relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg">LIVE</div>
              <p className="text-slate-300 text-sm mb-1">Availability</p>
              {totalRemaining <= 0 ? (
                <p className="font-bold text-xl text-amber-400">Waitlist Only</p>
              ) : totalRemaining <= 63 ? (
                <p className="font-bold text-base text-red-400 mt-1 uppercase tracking-wider">Critical: Very Limited Seats</p>
              ) : (
                <p className="font-bold text-base text-blue-300 mt-1 uppercase tracking-wider">Limited seats available</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {isCompletelyFull ? (
        <div className="bg-amber-100 border-b border-amber-200 text-amber-900 py-4 px-4 sm:px-8 text-center text-sm font-medium">
          The primary flight is currently full. We are accepting priority waitlist reservations. If the waitlist fills, we will charter an additional flight.
        </div>
      ) : isPartiallyFull ? (
        <div className="bg-amber-100 border-b border-amber-200 text-amber-900 py-4 px-4 sm:px-8 text-center text-sm font-medium">
          One or more cabin classes are currently full. Priority waitlist reservations are now open for those classes.
        </div>
      ) : null}

      <div className="bg-white py-8 border-b border-slate-200 shadow-sm relative z-20 mx-4 sm:mx-8 lg:mx-auto max-w-7xl rounded-b-xl px-4 sm:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
          <div className="flex gap-3 items-start">
            <div className="bg-green-100 p-2 rounded-full text-green-600 shrink-0"><ShieldCheck size={20} /></div>
            <div>
              <h3 className="font-bold text-base mb-1 text-slate-900">Refundable Cancellations</h3>
              <p className="text-slate-600">All ticket purchases are refundable if the charter flight does not operate.</p>
            </div>
          </div>
          <div className="flex gap-3 items-start">
            <div className="bg-blue-100 p-2 rounded-full text-blue-600 shrink-0"><CheckCircle size={20} /></div>
            <div>
              <h3 className="font-bold text-base mb-1 text-slate-900">Instant Reservation</h3>
              <p className="text-slate-600">Seats (or waitlist spots) are secured once payment is received.</p>
            </div>
          </div>
          <div className="flex gap-3 items-start">
            <div className="bg-indigo-100 p-2 rounded-full text-indigo-600 shrink-0"><Users size={20} /></div>
            <div>
              <h3 className="font-bold text-base mb-1 text-slate-900">Family Seating</h3>
              <p className="text-slate-600">Families and groups booking together will be seated together whenever possible.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-3xl font-bold mb-8 text-center">Select Your Class</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          {Object.values(CABIN_CLASSES).map((cabin) => {
            const remaining = flightStatus[`${cabin.dbPrefix}_remaining`];
            const isWaitlist = remaining <= 0;
            const showCount = remaining > 0 && remaining <= (cabin.capacity * 0.5);

            return (
              <div key={cabin.id} className={`bg-white rounded-xl shadow-sm border-2 overflow-hidden flex flex-col ${cabin.id === 'business' ? 'border-blue-900 shadow-lg' : 'border-slate-200'}`}>
                <div className={`${cabin.color} text-white px-6 py-4 flex justify-between items-center relative`}>
                  <h3 className="text-xl font-bold">{cabin.name}</h3>
                  <div className="text-right">
                    <span className="text-2xl font-extrabold">${cabin.price.toLocaleString()}</span>
                    <span className="text-sm opacity-80 block">/ seat</span>
                  </div>
                </div>
                
                <div className="bg-slate-50 border-b border-slate-200 py-2 px-6 flex justify-center min-h-[40px] items-center">
                  {isWaitlist ? (
                    <span className="bg-amber-100 text-amber-800 border border-amber-300 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1"><AlertCircle size={14}/> Waitlist Open</span>
                  ) : showCount ? (
                    <span className="bg-red-100 text-red-700 border border-red-300 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1"><Clock size={14}/> {remaining} Seats Left</span>
                  ) : (
                    <span className="text-slate-400 text-xs uppercase tracking-wider font-semibold">Available</span>
                  )}
                </div>

                <div className="p-6 flex-grow">
                  <ul className="space-y-3 mb-8">
                    {cabin.features.map((feature, i) => (
                      <li key={i} className="flex items-center gap-2 text-slate-700 text-sm">
                        <CheckCircle size={16} className={`${cabin.id === 'business' ? 'text-blue-600' : 'text-slate-400'} shrink-0`} /> {feature}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="p-6 pt-0 mt-auto">
                  <button 
                    onClick={() => onSelectCabin(cabin.id)}
                    className={`w-full py-3 rounded-lg font-bold transition-all shadow flex items-center justify-center gap-2
                      ${isWaitlist ? 'bg-amber-600 text-white hover:bg-amber-700' : cabin.id === 'business' ? 'bg-blue-900 text-white hover:bg-blue-800' : 'bg-slate-900 text-white hover:bg-slate-800'}`}
                  >
                    {isWaitlist ? `Join Waitlist` : `Select ${cabin.name}`} <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mb-16">
          <h2 className="text-3xl font-bold mb-8 text-center text-[#0a192f]">Why This Charter Flight</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center text-center">
              <div className="bg-blue-50 p-3 rounded-full mb-4"><MapPin size={24} className="text-blue-600" /></div>
              <h4 className="font-bold text-slate-900 mb-2">Direct departure from Tel Aviv</h4>
              <p className="text-sm text-slate-600">Avoid complicated overland travel routes and multiple connections.</p>
            </div>
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center text-center">
              <div className="bg-blue-50 p-3 rounded-full mb-4"><Plane size={24} className="text-blue-600" /></div>
              <h4 className="font-bold text-slate-900 mb-2">Fast onward connections</h4>
              <p className="text-sm text-slate-600">Arrive in Frankfurt (FRA) for easy onward flights to international destinations.</p>
            </div>
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center text-center">
              <div className="bg-blue-50 p-3 rounded-full mb-4"><Users size={24} className="text-blue-600" /></div>
              <h4 className="font-bold text-slate-900 mb-2">Organized coordination</h4>
              <p className="text-sm text-slate-600">Arranged through Chapman Freeborn, a global aircraft charter specialist.</p>
            </div>
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center text-center">
              <div className="bg-blue-50 p-3 rounded-full mb-4"><ShieldCheck size={24} className="text-blue-600" /></div>
              <h4 className="font-bold text-slate-900 mb-2">Widebody aircraft comfort</h4>
              <p className="text-sm text-slate-600">Operated on a widebody {FLIGHT_INFO.aircraft}.</p>
            </div>
          </div>
          <p className="text-center text-sm mt-6 text-slate-500 italic px-4 max-w-3xl mx-auto">
            Frankfurt is one of Europe's largest aviation hubs, offering dozens of daily flights to North America and other international destinations.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16">
          <div className="bg-amber-50 p-8 rounded-xl border border-amber-200 text-amber-900 shadow-sm">
            <h2 className="text-2xl font-bold flex items-center gap-2 mb-4"><AlertCircle size={24} className="text-amber-600"/> Important Info</h2>
            <div className="space-y-4 text-sm">
              <p><strong>Flight Confirmation & Security:</strong> Due to the regional security situation, exact departure date and time are subject to change. Final schedule details will be confirmed 48 to 72 hours prior to departure.</p>
              <p><strong>Onward Travel:</strong> We strongly recommend waiting until final flight confirmation is received before booking onward flights from Frankfurt.</p>
              <p><strong>Check-in:</strong> Passengers are advised to arrive at TLV airport at least <strong>3.5 hours</strong> prior to departure for check-in and security procedures.</p>
              <p><strong>Destination:</strong> This flight will land directly at Frankfurt Airport (FRA).</p>
              <p><strong>Waitlist Policy:</strong> If the primary flight is full, you are securing a spot on the waitlist. Wire transfers are required to hold a waitlist spot and are fully refundable if a flight is not chartered.</p>
            </div>
          </div>
          
          <div className="bg-slate-100 p-8 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center">
            <h2 className="text-2xl font-bold flex items-center gap-2 mb-4"><FileText size={24} className="text-slate-600"/> Legal Notice</h2>
            <div className="text-sm text-slate-600 space-y-4 leading-relaxed">
              <p>This is a privately organized charter flight arranged through a licensed aircraft charter broker. Rescue Charters LLC acts solely as an independent charter coordinator.</p>
              <p><strong>Limitation of Liability:</strong> Rescue Charters LLC is not responsible or liable for any direct, indirect, incidental, or consequential damages, missed connections, delays, cancellations, or losses of any kind arising from or relating to the operation or non-operation of this flight.</p>
              <p>All ticket purchases are fully refundable if the charter flight does not operate. In such a case, passengers will receive a full refund of the ticket price within 30 business days, less any non-refundable payment processing fees.</p>
            </div>
          </div>
        </div>

        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold flex justify-center items-center gap-2 mb-8 text-[#0a192f]"><HelpCircle size={28} className="text-blue-600"/> Frequently Asked Questions</h2>
          <div className="space-y-3">
            {faqs.map((faq, idx) => (
              <div key={idx} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden transition-all">
                <button onClick={() => toggleFaq(idx)} className="w-full px-6 py-4 text-left font-bold text-slate-900 flex justify-between items-center hover:bg-slate-50">
                  {faq.q}
                  {openFaq === idx ? <ChevronUp size={20} className="text-slate-400"/> : <ChevronDown size={20} className="text-slate-400"/>}
                </button>
                {openFaq === idx && (
                  <div className="px-6 pb-5 pt-2 text-sm text-slate-600 border-t border-slate-100">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function BookingFlow({ setView, selectedCabin, user, supabase, flightStatus }) {
  const [step, setStep] = useState(1);
  const [passengers, setPassengers] = useState([{ 
    firstName: '', middleName: '', lastName: '', 
    email: '', phoneCode: '+1', phone: '', 
    emergencyName: '', emergencyPhoneCode: '+1', emergencyPhone: '', 
    passport: '', passportIssue: '', passportExpiry: '', passportIssueCountry: '', 
    dob: '', nationality: '', gender: '', passengerType: 'Adult'
  }]);
  
  const [paymentMethod, setPaymentMethod] = useState('wire');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [bookingResponse, setBookingResponse] = useState(null); 
  const [formErrors, setFormErrors] = useState([]);
  const [checkoutError, setCheckoutError] = useState(''); 

  const cabinDetails = CABIN_CLASSES[selectedCabin];
  const subtotal = cabinDetails.price * passengers.length;
  const totalAmount = subtotal;

  const remainingInClass = flightStatus[`${cabinDetails.dbPrefix}_remaining`];
  const isWaitlistSpot = remainingInClass < passengers.length;

  const handlePassChange = (index, field, value) => {
    const newPass = [...passengers];
    if (field === 'phone' || field === 'emergencyPhone') {
      value = formatPhoneNumber(value);
    }
    newPass[index][field] = value;
    setPassengers(newPass);
    setFormErrors(formErrors.filter(e => !(e.index === index && e.field === field)));
    setCheckoutError('');
  };

  const addPassenger = () => setPassengers([...passengers, { 
    firstName: '', middleName: '', lastName: '', 
    email: '', phoneCode: '+1', phone: '', 
    emergencyName: '', emergencyPhoneCode: '+1', emergencyPhone: '', 
    passport: '', passportIssue: '', passportExpiry: '', passportIssueCountry: '', 
    dob: '', nationality: '', gender: '', passengerType: 'Adult' 
  }]);
  
  const removePassenger = (index) => {
    if (passengers.length > 1) {
      setPassengers(passengers.filter((_, i) => i !== index));
      setFormErrors(formErrors.filter(e => e.index !== index));
    }
  };

  const validateStep1 = () => {
    let errors = [];
    passengers.forEach((p, i) => {
      if (!p.firstName.trim()) errors.push({ index: i, field: 'firstName', msg: 'Required' });
      if (!p.lastName.trim()) errors.push({ index: i, field: 'lastName', msg: 'Required' });
      if (!p.email.includes('@')) errors.push({ index: i, field: 'email', msg: 'Required' });
      if (p.phone.replace(/\D/g, '').length < 10) errors.push({ index: i, field: 'phone', msg: 'Required' });
      if (!p.emergencyName.trim()) errors.push({ index: i, field: 'emergencyName', msg: 'Required' });
      if (p.emergencyPhone.replace(/\D/g, '').length < 10) errors.push({ index: i, field: 'emergencyPhone', msg: 'Required' });
      if (!p.passport.trim()) errors.push({ index: i, field: 'passport', msg: 'Required' });
      if (!p.passportIssue) errors.push({ index: i, field: 'passportIssue', msg: 'Required' });
      if (!p.passportExpiry) errors.push({ index: i, field: 'passportExpiry', msg: 'Required' });
      if (!p.passportIssueCountry.trim()) errors.push({ index: i, field: 'passportIssueCountry', msg: 'Required' });
      if (!p.dob) errors.push({ index: i, field: 'dob', msg: 'Required' });
      if (!p.nationality.trim()) errors.push({ index: i, field: 'nationality', msg: 'Required' });
      if (!p.gender) errors.push({ index: i, field: 'gender', msg: 'Required' });
      if (!p.passengerType) errors.push({ index: i, field: 'passengerType', msg: 'Required' });
    });
    setFormErrors(errors);
    return errors.length === 0;
  };

  const handleContinueToPayment = () => {
    setCheckoutError('');
    if (validateStep1()) {
      setStep(2);
      window.scrollTo(0,0);
    } else {
      setCheckoutError("Please complete all required fields highlighted in red before proceeding.");
    }
  };

  const handleCheckout = async (e) => {
    e.preventDefault();
    setCheckoutError('');

    if (!agreedToTerms) {
      setCheckoutError("You must agree to the Terms & Conditions to proceed.");
      return;
    }
    
    setIsProcessing(true);

    try {
      const { data, error } = await supabase.rpc('make_reservation', {
        p_user_id: user.id,
        p_payment_method: paymentMethod,
        p_total_amount: totalAmount,
        p_cabin_class: selectedCabin,
        p_contact_name: `${passengers[0].firstName} ${passengers[0].lastName}`,
        p_email: passengers[0].email,
        p_phone: `${passengers[0].phoneCode} ${passengers[0].phone}`,
        p_passenger_count: passengers.length,
        p_passengers: passengers
      });

      if (error) throw error;
      
      setBookingResponse({ ref: data.booking_ref, isWaitlist: data.is_waitlist });
      setStep(3);
      window.scrollTo(0,0);
    } catch (error) {
      console.error("Booking error:", error);
      setCheckoutError(`Booking Failed: ${error.message || "An unexpected error occurred."}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const hasError = (index, field) => formErrors.some(e => e.index === index && e.field === field);
  const inputClass = (index, field) => `w-full border rounded-md p-2.5 outline-none focus:ring-2 focus:ring-blue-500 ${hasError(index, field) ? 'border-red-500 bg-red-50' : 'border-slate-300'}`;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in slide-in-from-bottom-4 duration-500">
      <div className="mb-8">
        <button onClick={() => setView('landing')} className="text-blue-600 font-medium hover:underline mb-6 inline-flex items-center gap-1">
          &larr; Back to Flight Details
        </button>
        <div className="flex justify-between items-end border-b border-slate-200 pb-4">
          <div>
            <h1 className="text-3xl font-bold">Secure Checkout</h1>
            <p className="text-slate-600 mt-1">Class: <strong>{cabinDetails.name}</strong> (${cabinDetails.price.toLocaleString()}/seat)</p>
          </div>
          <div className="text-right hidden sm:block">
            <div className="text-sm text-slate-500">Total</div>
            <div className="text-2xl font-extrabold">${subtotal.toLocaleString()}</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {step === 1 && (
          <div className="p-6 sm:p-8">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><Users size={20} className="text-blue-600"/> Passenger Information</h2>
            
            {checkoutError && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center gap-2 text-sm font-medium">
                <AlertCircle size={18} /> {checkoutError}
              </div>
            )}

            <div className="space-y-8">
              {passengers.map((p, index) => (
                <div key={index} className="bg-slate-50 border border-slate-200 rounded-lg p-5 relative">
                  {index > 0 && <button onClick={() => removePassenger(index)} className="absolute top-4 right-4 text-red-500 text-sm font-bold hover:underline">Remove</button>}
                  <h3 className="font-semibold text-lg mb-4 text-slate-800 border-b border-slate-200 pb-2">Passenger {index + 1}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wide mb-1">First Name (Exactly as on passport) *</label>
                      <input type="text" value={p.firstName} name={`firstName_${index}`} autoComplete="given-name" onChange={(e) => handlePassChange(index, 'firstName', e.target.value)} className={inputClass(index, 'firstName')} required/>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wide mb-1">Middle Name (Exactly as on passport)</label>
                      <input type="text" value={p.middleName} name={`middleName_${index}`} autoComplete="additional-name" onChange={(e) => handlePassChange(index, 'middleName', e.target.value)} className={inputClass(index, 'middleName')} placeholder="(Optional)" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wide mb-1">Last Name (Exactly as on passport) *</label>
                      <input type="text" value={p.lastName} name={`lastName_${index}`} autoComplete="family-name" onChange={(e) => handlePassChange(index, 'lastName', e.target.value)} className={inputClass(index, 'lastName')} required/>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1">Passenger Type *</label>
                      <select value={p.passengerType} name={`passengerType_${index}`} onChange={(e) => handlePassChange(index, 'passengerType', e.target.value)} className={`${inputClass(index, 'passengerType')} bg-white`} required>
                        <option value="Adult">Adult</option>
                        <option value="Child">Child (2 - 11 years)</option>
                        <option value="Infant">Infant (Under 2 years)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1">Gender *</label>
                      <select value={p.gender} name={`gender_${index}`} autoComplete="sex" onChange={(e) => handlePassChange(index, 'gender', e.target.value)} className={`${inputClass(index, 'gender')} bg-white`} required>
                        <option value="">Select</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1">Date of Birth *</label>
                      <input type="date" value={p.dob} name={`dob_${index}`} autoComplete="bday" onChange={(e) => handlePassChange(index, 'dob', e.target.value)} className={inputClass(index, 'dob')} required/>
                    </div>
                    
                    <div className="md:col-span-1">
                      <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1">Email Address *</label>
                      <input type="email" value={p.email} name={`email_${index}`} autoComplete="email" onChange={(e) => handlePassChange(index, 'email', e.target.value)} className={inputClass(index, 'email')} placeholder="name@example.com" required/>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1">Phone Number *</label>
                      <div className="flex gap-2">
                        <select value={p.phoneCode} name={`phoneCode_${index}`} autoComplete="tel-country-code" onChange={(e) => handlePassChange(index, 'phoneCode', e.target.value)} className="w-1/3 border border-slate-300 rounded-md p-2.5 outline-none bg-white">
                          {COUNTRY_CODES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
                        </select>
                        <input type="tel" value={p.phone} name={`phone_${index}`} autoComplete="tel-national" onChange={(e) => handlePassChange(index, 'phone', e.target.value)} className={`${inputClass(index, 'phone')} w-2/3`} placeholder="(555) 000-0000" required/>
                      </div>
                    </div>
                    
                    <div className="md:col-span-3 mt-4 border-t border-slate-200 pt-4">
                      <h4 className="text-sm font-bold text-slate-800 mb-3">Passport Details</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        <div>
                          <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1">Passport Number *</label>
                          <input type="text" value={p.passport} name={`passport_${index}`} onChange={(e) => handlePassChange(index, 'passport', e.target.value)} className={inputClass(index, 'passport')} required/>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1">Nationality *</label>
                          <input type="text" value={p.nationality} name={`nationality_${index}`} autoComplete="country-name" onChange={(e) => handlePassChange(index, 'nationality', e.target.value)} className={inputClass(index, 'nationality')} placeholder="e.g. USA" required/>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1">Country of Issue *</label>
                          <input type="text" value={p.passportIssueCountry} name={`passportIssueCountry_${index}`} onChange={(e) => handlePassChange(index, 'passportIssueCountry', e.target.value)} className={inputClass(index, 'passportIssueCountry')} placeholder="e.g. USA" required/>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1">Date of Issue *</label>
                          <input type="date" value={p.passportIssue} name={`passportIssue_${index}`} onChange={(e) => handlePassChange(index, 'passportIssue', e.target.value)} className={inputClass(index, 'passportIssue')} required/>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1">Date of Expiration *</label>
                          <input type="date" value={p.passportExpiry} name={`passportExpiry_${index}`} onChange={(e) => handlePassChange(index, 'passportExpiry', e.target.value)} className={inputClass(index, 'passportExpiry')} required/>
                        </div>
                      </div>
                    </div>

                    <div className="md:col-span-3 mt-4 border-t border-slate-200 pt-4">
                      <h4 className="text-sm font-bold text-slate-800 mb-3">Emergency Contact Information</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                          <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1">Emergency Contact Name *</label>
                          <input type="text" value={p.emergencyName} name={`emergencyName_${index}`} onChange={(e) => handlePassChange(index, 'emergencyName', e.target.value)} className={inputClass(index, 'emergencyName')} placeholder="Jane Doe" required/>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1">Emergency Phone *</label>
                          <div className="flex gap-2">
                            <select value={p.emergencyPhoneCode} name={`emergencyPhoneCode_${index}`} onChange={(e) => handlePassChange(index, 'emergencyPhoneCode', e.target.value)} className="w-1/3 border border-slate-300 rounded-md p-2.5 outline-none bg-white">
                              {COUNTRY_CODES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
                            </select>
                            <input type="tel" value={p.emergencyPhone} name={`emergencyPhone_${index}`} onChange={(e) => handlePassChange(index, 'emergencyPhone', e.target.value)} className={`${inputClass(index, 'emergencyPhone')} w-2/3`} placeholder="(555) 012-3456" required/>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 flex flex-col sm:flex-row justify-between items-center gap-4">
              <button onClick={addPassenger} className="text-blue-600 font-bold hover:bg-blue-50 px-4 py-2 rounded transition-colors w-full sm:w-auto border border-blue-200">
                + Add Another Passenger
              </button>
              <button onClick={handleContinueToPayment} className="w-full sm:w-auto bg-[#0a192f] text-white px-8 py-3 rounded-lg font-bold hover:bg-slate-800 transition-colors">
                Continue to Payment
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <form onSubmit={handleCheckout} className="p-6 sm:p-8 animate-in fade-in">
            {isWaitlistSpot && (
              <div className="bg-amber-100 border-l-4 border-amber-500 p-4 mb-8 text-amber-900 rounded-r shadow-sm">
                <p className="font-bold flex items-center gap-2 mb-1"><AlertCircle size={18}/> Notice: This is a Waitlist Spot</p>
                <p className="text-sm">The specific cabin class you requested is currently full. By proceeding, you are joining the priority waitlist. If the waitlist fills, we will charter an additional flight. You must complete the wire transfer to secure your spot.</p>
              </div>
            )}

            <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><CreditCard size={20} className="text-blue-600"/> Payment Options</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              <div className="border-2 rounded-xl p-4 flex flex-col items-center justify-center text-center transition-all border-slate-200 opacity-60 bg-slate-50 cursor-not-allowed">
                <CreditCard size={32} className="mb-2 text-slate-400" />
                <h3 className="font-bold">Credit Card</h3>
                <p className="text-xs text-slate-500 mt-1">Credit card payments will be available shortly.</p>
              </div>
              <div onClick={() => setPaymentMethod('wire')} className={`cursor-pointer border-2 rounded-xl p-4 flex flex-col items-center justify-center text-center transition-all ${paymentMethod === 'wire' ? 'border-blue-600 bg-blue-50 shadow-sm' : 'border-slate-200 hover:border-slate-300'}`}>
                <Landmark size={32} className={`mb-2 ${paymentMethod === 'wire' ? 'text-blue-600' : 'text-slate-400'}`} />
                <h3 className="font-bold">Bank Wire</h3>
                <p className="text-xs text-slate-500 mt-1">
                  {isWaitlistSpot ? 'Wire transfer required to hold your position on the waitlist.' : 'To reserve your seat, payment must be made via wire transfer.'}
                </p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-6 border border-slate-200 mb-8">
              <h3 className="font-bold text-lg border-b border-slate-200 pb-2 mb-4">Order Summary</h3>
              <div className="space-y-2 text-sm text-slate-700 mb-4">
                <div className="flex justify-between">
                  <span>{cabinDetails.name} {isWaitlistSpot ? 'Waitlist Spot' : 'Seat'} x {passengers.length}</span>
                  <span>${subtotal.toLocaleString()}</span>
                </div>
              </div>
              <div className="flex justify-between text-xl font-extrabold border-t border-slate-200 pt-4">
                <span>Total Due</span>
                <span>${totalAmount.toLocaleString()}</span>
              </div>

              {paymentMethod === 'wire' && (
                <div className="mt-6 border-t border-slate-200 pt-6">
                  <div className="bg-blue-100 border border-blue-200 text-blue-900 p-4 rounded-lg text-sm shadow-sm">
                    <p className="font-bold mb-1">Wire Transfer Selected</p>
                    <p>Upon clicking "Complete", we will instantly email wire instructions to <strong>{passengers[0].email}</strong>. You must initiate the wire within <strong>6 hours</strong> to guarantee your {isWaitlistSpot ? 'waitlist position' : 'reservation'}.</p>
                  </div>
                </div>
              )}
            </div>

            <div className="mb-8">
              <h3 className="font-bold mb-3 flex items-center gap-2"><FileText size={18}/> Terms & Conditions</h3>
              <div className="bg-slate-100 p-4 rounded-lg text-xs text-slate-700 space-y-2 h-32 overflow-y-auto border border-slate-200 mb-4">
                <p>All ticket purchases are fully refundable if the charter flight does not operate. In such a case, passengers will receive a full refund of the ticket price within 30 business days, less any non-refundable payment processing fees.</p>
                <p className="mt-2 font-bold text-slate-900">Limitation of Liability:</p>
                <p>Rescue Charters LLC acts solely as an independent flight coordinator and intermediary. Rescue Charters LLC is not responsible or liable for any delays, cancellations, missed connections, or any direct, indirect, incidental, or consequential damages resulting from the operation or non-operation of this flight.</p>
                <p className="mt-2">By purchasing a ticket you acknowledge that:</p>
                <ul className="list-disc pl-4 space-y-1">
                  <li>This is a privately organized charter flight.</li>
                  <li>Due to regional security, exact departure dates and times are subject to change and will be finalized 48-72 hours prior.</li>
                  <li>Passengers are responsible for all onward travel arrangements.</li>
                </ul>
              </div>
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={agreedToTerms} onChange={(e) => setAgreedToTerms(e.target.checked)} className="mt-1 w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500" />
                <span className="text-sm font-medium text-slate-800">I agree to the Terms & Conditions and Liability Waiver.</span>
              </label>
            </div>

            <div className="flex justify-between items-center border-t border-slate-200 pt-6">
              <button type="button" onClick={() => setStep(1)} className="text-slate-500 font-medium hover:text-slate-800 px-4 py-2">&larr; Back</button>
              <button type="submit" disabled={isProcessing || !agreedToTerms} className={`text-white px-8 py-3 rounded-lg font-bold disabled:opacity-50 transition-colors flex items-center gap-2 ${isWaitlistSpot ? 'bg-amber-600 hover:bg-amber-700' : 'bg-[#0a192f] hover:bg-slate-800'}`}>
                {isProcessing ? (
                  <><div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div> Processing...</>
                ) : (
                  isWaitlistSpot ? 'Join Priority Waitlist' : 'Complete Reservation'
                )}
              </button>
            </div>
          </form>
        )}

        {step === 3 && bookingResponse && (
          <div className="text-center py-16 px-6 animate-in zoom-in-95 duration-500">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${bookingResponse.isWaitlist ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-green-600'}`}>
              <CheckCircle size={40} />
            </div>
            
            <h2 className="text-3xl font-extrabold mb-2">{bookingResponse.isWaitlist ? 'Waitlist Spot Held' : 'Reservation Held'}</h2>
            <p className="text-lg text-slate-600 mb-8 max-w-md mx-auto">
              <strong>Wire instructions have been emailed to {passengers[0].email}.</strong> Please complete the transfer within 6 hours.
            </p>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 max-w-sm mx-auto mb-8 text-left">
              <p className="text-sm text-slate-500 mb-1">Booking Reference</p>
              <p className="text-2xl font-mono font-bold mb-4 tracking-wider text-[#0a192f]">{bookingResponse.ref}</p>
              
              <p className="text-sm text-slate-500 mb-1">{bookingResponse.isWaitlist ? 'Waitlist Spots' : 'Seats Requested'}</p>
              <p className="font-semibold mb-4">{passengers.length} x {cabinDetails.name}</p>

              <p className="text-sm text-slate-500 mb-2">Status</p>
              <div>
                <p className={`font-semibold border inline-block px-2 py-0.5 rounded text-sm mb-2 ${bookingResponse.isWaitlist ? 'text-amber-700 bg-amber-100 border-amber-200' : 'text-[#0a192f] bg-blue-100 border-blue-200'}`}>
                  {bookingResponse.isWaitlist ? 'Waitlist — awaiting wire transfer' : 'Reservation Held — awaiting wire transfer'}
                </p>
                <p className="text-xs text-slate-500 leading-tight">
                  Wire must be received within 6 hours to guarantee your spot.
                </p>
              </div>
            </div>

            <button onClick={() => setView('landing')} className="bg-[#0a192f] text-white px-8 py-3 rounded-lg font-bold hover:bg-slate-800 transition-colors">
              Return to Homepage
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function LookupView({ setView, supabase }) {
  const [email, setEmail] = useState('');
  const [ref, setRef] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  const handleLookup = async (e) => {
    e.preventDefault();
    setIsSearching(true);
    setErrorMsg('');
    try {
      const { data, error } = await supabase.rpc('lookup_reservation', { p_email: email, p_ref: ref });
      if (error) throw error;
      if (!data || data.length === 0) setErrorMsg('No booking found. Please check your email and reference code.');
      else setResult(data[0]);
    } catch (err) {
      setErrorMsg('An error occurred during lookup.');
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-16 animate-in fade-in">
      <button onClick={() => setView('landing')} className="text-blue-600 font-medium hover:underline mb-6 inline-flex items-center gap-1">&larr; Back Home</button>
      <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
        <h2 className="text-2xl font-bold mb-2">Find Reservation</h2>
        <p className="text-sm text-slate-500 mb-6">Enter your details to check your booking status.</p>
        
        {errorMsg && <p className="text-red-500 text-sm mb-4 bg-red-50 p-3 rounded border border-red-100">{errorMsg}</p>}

        {!result ? (
          <form onSubmit={handleLookup} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Email Address</label>
              <input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} className="w-full border border-slate-300 rounded-md p-2.5 outline-none focus:ring-2 focus:ring-blue-500" required />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Booking Reference</label>
              <input type="text" value={ref} onChange={(e)=>setRef(e.target.value)} className="w-full border border-slate-300 rounded-md p-2.5 outline-none focus:ring-2 focus:ring-blue-500 uppercase" placeholder="e.g. 8F92A1" required />
            </div>
            <button type="submit" disabled={isSearching} className="w-full bg-[#0a192f] text-white py-3 rounded-lg font-bold hover:bg-slate-800 transition-colors mt-4">
              {isSearching ? 'Searching...' : 'Lookup Booking'}
            </button>
          </form>
        ) : (
          <div className="text-center">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle size={24} /></div>
            <h3 className="text-xl font-bold text-[#0a192f] mb-4">Reservation Found</h3>
            <div className="bg-slate-50 p-4 rounded-lg text-left text-sm space-y-2 border border-slate-200">
              <p className="flex justify-between"><span className="text-slate-500">Class:</span> <strong>{result.cabin_class.toUpperCase()}</strong></p>
              <p className="flex justify-between"><span className="text-slate-500">Passengers:</span> <strong>{result.passenger_count}</strong></p>
              <div className="pt-2 mt-2 border-t border-slate-200">
                <p className="text-slate-500 mb-1">Status:</p>
                <p className={`font-semibold px-2 py-1 rounded inline-block text-xs uppercase tracking-wider ${result.payment_status === 'waitlist' ? 'text-amber-700 bg-amber-100 border border-amber-200' : 'text-blue-700 bg-blue-100 border border-blue-200'}`}>
                  {result.payment_status.replace('_', ' ')}
                </p>
              </div>
            </div>
            <button onClick={() => setResult(null)} className="text-blue-600 text-sm font-medium hover:underline mt-6">Look up another</button>
          </div>
        )}
      </div>
    </div>
  );
}

function AdminView({ setView, flightStatus }) {
  const [auth, setAuth] = useState(false);
  const [pin, setPin] = useState('');

  const totalReserved = flightStatus.eco_reserved + flightStatus.prem_reserved + flightStatus.biz_reserved;

  if (!auth) {
    return (
      <div className="max-w-sm mx-auto px-4 py-24 text-center">
        <Lock className="mx-auto text-slate-400 mb-4" size={32} />
        <h2 className="text-xl font-bold mb-4">Admin Dashboard</h2>
        <div className="text-xs text-slate-500 mb-6 px-4">
          Note: This dashboard only shows public aggregate data. Passenger PII is securely locked in the database.
        </div>
        <input type="password" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="Enter PIN" className="w-full border border-slate-300 rounded p-2 text-center tracking-widest mb-4" />
        <button onClick={() => pin === ADMIN_PIN ? setAuth(true) : alert('Invalid')} className="w-full bg-slate-900 text-white py-2 rounded font-bold">Login</button>
      </div>
    );
  }
  return (
    <div className="max-w-5xl mx-auto px-4 py-12 animate-in fade-in">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-[#0a192f]">Live Flight Overview</h1>
        <button onClick={() => setView('landing')} className="text-slate-500 hover:text-slate-900 font-medium">Exit</button>
      </div>
      
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-8 text-center">
        <p className="text-slate-500 text-sm font-bold uppercase mb-1">Total Seats Reserved (All Classes)</p>
        <p className="text-5xl font-extrabold text-[#0a192f]">{totalReserved} <span className="text-xl text-slate-400 font-medium">/ 253</span></p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
          <h3 className="font-bold text-slate-800 border-b border-slate-200 pb-2 mb-4">Economy</h3>
          <div className="flex justify-between mb-2">
            <span className="text-slate-500">Reserved</span>
            <span className="font-bold">{flightStatus.eco_reserved}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Remaining</span>
            <span className={`font-bold ${flightStatus.eco_remaining <= 0 ? 'text-red-500' : 'text-blue-600'}`}>{flightStatus.eco_remaining <= 0 ? 0 : flightStatus.eco_remaining}</span>
          </div>
          {flightStatus.eco_remaining < 0 && <p className="text-xs text-amber-600 font-bold mt-3 text-right">Waitlist: {Math.abs(flightStatus.eco_remaining)} pax</p>}
        </div>

        <div className="bg-indigo-50 p-6 rounded-xl border border-indigo-100">
          <h3 className="font-bold text-indigo-900 border-b border-indigo-200 pb-2 mb-4">Economy+</h3>
          <div className="flex justify-between mb-2">
            <span className="text-indigo-700">Reserved</span>
            <span className="font-bold text-indigo-900">{flightStatus.prem_reserved}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-indigo-700">Remaining</span>
            <span className={`font-bold ${flightStatus.prem_remaining <= 0 ? 'text-red-500' : 'text-indigo-900'}`}>{flightStatus.prem_remaining <= 0 ? 0 : flightStatus.prem_remaining}</span>
          </div>
          {flightStatus.prem_remaining < 0 && <p className="text-xs text-amber-600 font-bold mt-3 text-right">Waitlist: {Math.abs(flightStatus.prem_remaining)} pax</p>}
        </div>

        <div className="bg-blue-50 p-6 rounded-xl border border-blue-100">
          <h3 className="font-bold text-blue-900 border-b border-blue-200 pb-2 mb-4">Business</h3>
          <div className="flex justify-between mb-2">
            <span className="text-blue-700">Reserved</span>
            <span className="font-bold text-blue-900">{flightStatus.biz_reserved}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-blue-700">Remaining</span>
            <span className={`font-bold ${flightStatus.biz_remaining <= 0 ? 'text-red-500' : 'text-blue-900'}`}>{flightStatus.biz_remaining <= 0 ? 0 : flightStatus.biz_remaining}</span>
          </div>
          {flightStatus.biz_remaining < 0 && <p className="text-xs text-amber-600 font-bold mt-3 text-right">Waitlist: {Math.abs(flightStatus.biz_remaining)} pax</p>}
        </div>
      </div>

      <div className="p-4 bg-slate-50 text-sm text-slate-600 border border-slate-200 rounded-xl">
        <p className="font-bold text-slate-800 mb-2">Operations Guide:</p>
        <p>1. To view individual bookings and confirm wires, log into your <strong>Supabase Dashboard</strong>.</p>
        <p>2. Open the <code>bookings</code> table to manage statuses.</p>
        <p>3. To export the flight manifest for the airline, go to <strong>Table Editor</strong> -&gt; <strong>confirmed_manifest</strong> view and click Export CSV.</p>
      </div>
    </div>
  );
}

function Footer({ setView }) {
  return (
    <footer className="bg-slate-900 text-slate-400 py-10 mt-auto border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-center md:text-left">
            <p className="text-white font-bold mb-1">Rescue Charters LLC</p>
            <p className="text-sm text-slate-500 mb-1">Operating as Israel Rescues.</p>
            <p className="text-xs text-slate-600">This is a privately organized charter flight. Rescue Charters LLC is not liable for indirect damages or delays.</p>
          </div>
          <div className="text-center md:text-right text-sm">
            <p className="mb-1">Contact: <a href="mailto:Help@IsraelRescues.com" className="text-blue-400 hover:underline">Help@IsraelRescues.com</a></p>
            <p className="mb-1">WhatsApp: <a href="https://wa.me/message/F2AKLDAS44RYJ1" target="_blank" rel="noopener noreferrer" className="text-green-400 hover:underline">Message Us</a></p>
            <div className="flex items-center justify-center md:justify-end gap-3 mt-2">
              <p className="text-slate-500">&copy; {new Date().getFullYear()} Rescue Charters LLC.</p>
              <span className="text-slate-700">|</span>
              <button onClick={() => setView('admin')} className="text-slate-600 hover:text-slate-400 transition-colors">Admin</button>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}