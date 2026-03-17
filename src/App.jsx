import React, { useState, useEffect } from 'react';
import { Plane, ShieldCheck, Clock, Users, ChevronRight, CheckCircle, CreditCard, AlertCircle, Landmark, HelpCircle, FileText, Check, ChevronDown, ChevronUp, MapPin, Search, Info } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { Analytics } from '@vercel/analytics/react';

// --- SUPABASE INITIALIZATION ---
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;

// --- CONSTANTS & CONFIG ---
const FLIGHT_INFO = {
  routeMain: 'Tel Aviv (TLV) to Europe',
  routeSub: 'Frankfurt (FRA) & Munich (MUC)',
  dateMain: 'Thursday, March 19',
  dateSub: 'Flights are currently full',
  operator: 'Operated by licensed air carriers',
  aircraft: 'Private Charter Flights',
};

const CABIN_CLASSES = {
  economy: { 
    id: 'economy', 
    dbPrefix: 'eco', 
    capacity: 120, 
    name: 'Economy Class', 
    price: 1650, 
    features: [
      'Standard seating', 
      '1x20kg checked bag + carry-on + personal item', 
      'Hot kosher meals included'
    ], 
    color: 'bg-slate-600' 
  },
  premium: { 
    id: 'premium', 
    dbPrefix: 'prem', 
    capacity: 60, 
    name: 'Economy+', 
    price: 1850, 
    features: [
      'Front section seating for rapid deplaning', 
      'Priority boarding & guaranteed overhead space',
      '1x20kg checked bag + carry-on + personal item', 
      'Hot kosher meals included'
    ], 
    color: 'bg-indigo-600' 
  }
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
    return ['landing', 'lookup', 'booking', 'waitlist'].includes(hash) ? hash : 'landing';
  });

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      const validView = ['landing', 'lookup', 'booking', 'waitlist'].includes(hash) ? hash : 'landing';
      setViewState(validView);
      window.scrollTo(0, 0); 
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const setView = (newView) => { window.location.hash = newView; };

  const [selectedCabin, setSelectedCabin] = useState('economy');
  const [flightStatus, setFlightStatus] = useState({ 
    eco_remaining: 0, prem_remaining: 0, biz_remaining: 0,
    eco_reserved: 120, prem_reserved: 60, biz_reserved: 0 
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

  if (!authInitialized || loadingData) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div></div>;
  if (!supabase) return <div className="min-h-screen flex items-center justify-center">Missing Supabase config.</div>;

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-blue-100 flex flex-col">
      <Navbar setView={setView} />
      
      {/* GLOBAL SOLD OUT BANNER */}
      <div className="bg-red-900 text-red-50 py-3 px-4 sm:px-8 text-center text-sm font-medium border-b border-red-950 shadow-inner">
        <AlertCircle size={16} className="inline mr-2 mb-0.5" />
        <strong>Update:</strong> All scheduled charter flights (Frankfurt and Munich) are completely sold out. We are no longer accepting new reservations or waitlist requests.
      </div>
      
      <main className="flex-grow">
        {view === 'landing' && <LandingView setView={setView} />}
        {view === 'lookup' && <LookupView setView={setView} supabase={supabase} />}
        {/* Hidden but completely intact below */}
        {view === 'booking' && <BookingFlow setView={setView} selectedCabin={selectedCabin} user={user} supabase={supabase} flightStatus={flightStatus} />}
        {view === 'waitlist' && <WaitlistFlow setView={setView} supabase={supabase} />}
      </main>
      <Footer />
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
            <button onClick={() => setView('lookup')} className="bg-white/10 px-4 py-2 rounded text-sm font-medium text-white hover:bg-white/20 transition-colors flex items-center gap-2">
              <Search size={16}/> Find Reservation
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}

function LandingView({ setView }) {
  const [openFaq, setOpenFaq] = useState(null);
  const toggleFaq = (index) => setOpenFaq(openFaq === index ? null : index);

  let faqs = [
    { q: "Who is organizing these flights?", a: "These flights are coordinated by Rescue Charters LLC. We’re not a commercial airline or an official organization. Like everyone else, we were in the exact same boat—struggling to find reliable flights out of Israel. We decided to organize these private charters to bring that option to the broader community." },
    { q: "Will there be more flights?", a: "At this time, both our Frankfurt and Munich flights are at maximum capacity and our manifests are closed. We are not organizing any additional flights or maintaining a waitlist at this time." },
    { q: "I have a reservation, how do I check my status?", a: "You can check the status of your payment and reservation by clicking the 'Find Reservation' button at the top of the page. You will need your email address and your booking reference code." },
    { q: "When will the final flight details be confirmed for passengers?", a: "Due to the regional security situation, final operational details and departure schedules will be confirmed 48 to 72 hours prior to departure. Passengers will receive full flight information via email at that time." },
    { q: "Can I get a refund?", a: "All ticket purchases are fully refundable if the charter flight does not operate. In such a case, passengers will receive a full refund of the ticket price." }
  ];

  return (
    <div className="animate-in fade-in duration-500 pb-16">
      <div className="relative bg-[#0a192f] text-white py-16 sm:py-24 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img src="https://images.unsplash.com/photo-1540962351504-03099e0a754b?q=80&w=2000&auto=format&fit=crop" alt="Widebody Aircraft" className="w-full h-full object-cover opacity-20 grayscale"/>
          <div className="absolute inset-0 bg-gradient-to-r from-[#0a192f] via-[#0a192f]/90 to-transparent"></div>
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center sm:text-left flex flex-col items-center sm:items-start">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/20 border border-red-500/30 text-red-200 text-sm font-bold mb-6 uppercase tracking-wider">
            All Flights Sold Out
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight mb-6 max-w-3xl">
            Emergency Charter Flights
          </h1>
          <p className="text-lg sm:text-xl text-slate-300 max-w-2xl mb-10 leading-relaxed">
            Due to overwhelming demand, all seats on our scheduled charter flights have been secured. We are no longer accepting reservations.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md sm:max-w-none">
            <button 
              onClick={() => setView('lookup')}
              className="bg-blue-600 text-white px-8 py-4 rounded-lg font-bold hover:bg-blue-500 transition-colors flex items-center justify-center gap-2 shadow-lg"
            >
              <Search size={20} /> Look Up Existing Reservation
            </button>
            <a 
              href="mailto:Help@IsraelRescues.com"
              className="bg-white/10 text-white px-8 py-4 rounded-lg font-bold hover:bg-white/20 transition-colors flex items-center justify-center gap-2 backdrop-blur-sm border border-white/10"
            >
              Contact Support
            </a>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="mb-16">
          <h2 className="text-3xl font-bold mb-8 text-center text-[#0a192f]">Flight Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center text-center opacity-75">
              <div className="bg-slate-100 p-3 rounded-full mb-4"><MapPin size={24} className="text-slate-600" /></div>
              <h4 className="font-bold text-slate-900 mb-2">Routes</h4>
              <p className="text-sm text-slate-600">Tel Aviv to Frankfurt (FRA) & Munich (MUC)</p>
            </div>
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center text-center opacity-75">
              <div className="bg-slate-100 p-3 rounded-full mb-4"><Plane size={24} className="text-slate-600" /></div>
              <h4 className="font-bold text-slate-900 mb-2">Organized coordination</h4>
              <p className="text-sm text-slate-600">Arranged through licensed aircraft charter specialists.</p>
            </div>
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center text-center opacity-75">
              <div className="bg-slate-100 p-3 rounded-full mb-4"><ShieldCheck size={24} className="text-slate-600" /></div>
              <h4 className="font-bold text-slate-900 mb-2">Safe Third Country</h4>
              <p className="text-sm text-slate-600">Landings in Germany, well outside the conflict zone.</p>
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
              <p className="flex justify-between"><span className="text-slate-500">Total Passengers:</span> <strong>{result.passenger_count}</strong></p>
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

function Footer() {
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
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

// === HIDDEN FORMS INTACT BELOW (BookingFlow & WaitlistFlow) ===

function WaitlistFlow({ setView, supabase }) {
  const [formData, setFormData] = useState({
    name: '', email: '', phoneCode: '+1', phone: '',
    passengerCount: 1, destination: '', earliestDeparture: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleChange = (e) => {
    let { name, value } = e.target;
    if (name === 'phone') value = formatPhoneNumber(value);
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const { error } = await supabase.from('waitlist').insert([{
        name: formData.name,
        email: formData.email,
        phone: `${formData.phoneCode} ${formData.phone}`,
        passenger_count: parseInt(formData.passengerCount, 10),
        desired_destination: formData.destination,
        earliest_departure: formData.earliestDeparture || null
      }]);

      if (error) throw error;
      setIsSuccess(true);
    } catch (err) {
      console.error(err);
      setErrorMsg('Failed to join waitlist. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 animate-in zoom-in-95 duration-500 text-center">
        <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle size={40} />
        </div>
        <h2 className="text-3xl font-extrabold mb-4">You're on the list!</h2>
        <p className="text-slate-600 mb-8">
          Thank you. We have recorded your interest for <strong>{formData.passengerCount} passenger{formData.passengerCount > 1 ? 's' : ''}</strong> to <strong>{formData.destination || 'a European Hub'}</strong>. 
        </p>
        <button onClick={() => setView('landing')} className="bg-[#0a192f] text-white px-8 py-3 rounded-lg font-bold hover:bg-slate-800 transition-colors">
          Return to Homepage
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12 animate-in slide-in-from-bottom-4 duration-500">
      <button onClick={() => setView('landing')} className="text-blue-600 font-medium hover:underline mb-6 inline-flex items-center gap-1">
        &larr; Back to Flight Details
      </button>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-[#0a192f] text-white p-6 sm:p-8">
          <h1 className="text-2xl font-bold mb-2">Future Flights Waitlist</h1>
          <p className="text-slate-300 text-sm">Join this priority list to help us gauge demand for additional charters.</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
          {errorMsg && <div className="bg-red-50 text-red-700 p-4 rounded-lg text-sm font-medium flex items-center gap-2"><AlertCircle size={18}/> {errorMsg}</div>}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Full Name *</label>
              <input type="text" name="name" value={formData.name} onChange={handleChange} className="w-full border border-slate-300 rounded-md p-2.5 outline-none focus:ring-2 focus:ring-blue-500" required />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Email Address *</label>
              <input type="email" name="email" value={formData.email} onChange={handleChange} className="w-full border border-slate-300 rounded-md p-2.5 outline-none focus:ring-2 focus:ring-blue-500" required />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1">Phone Number *</label>
              <div className="flex gap-2">
                <select name="phoneCode" value={formData.phoneCode} onChange={handleChange} className="w-1/3 md:w-1/4 border border-slate-300 rounded-md p-2.5 outline-none bg-white">
                  {COUNTRY_CODES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
                </select>
                <input type="tel" name="phone" value={formData.phone} onChange={handleChange} className="w-2/3 md:w-3/4 border border-slate-300 rounded-md p-2.5 outline-none focus:ring-2 focus:ring-blue-500" placeholder="(555) 000-0000" required/>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-6">
            <h3 className="font-bold text-slate-800 mb-4">Travel Needs</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">How many passengers? *</label>
                <input type="number" min="1" max="20" name="passengerCount" value={formData.passengerCount} onChange={handleChange} className="w-full border border-slate-300 rounded-md p-2.5 outline-none focus:ring-2 focus:ring-blue-500" required />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Where are you trying to go? *</label>
                <input type="text" name="destination" value={formData.destination} onChange={handleChange} className="w-full border border-slate-300 rounded-md p-2.5 outline-none focus:ring-2 focus:ring-blue-500" required />
              </div>
            </div>
          </div>

          <button type="submit" disabled={isSubmitting} className="w-full bg-blue-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 mt-4 flex justify-center items-center gap-2">
            {isSubmitting ? 'Joining...' : 'Join Priority Waitlist'}
          </button>
        </form>
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
    dob: '', nationality: '', gender: '', passengerType: 'Adult',
    wheelchair: false, meal: 'Standard Kosher'
  }]);
  
  const [paymentMethod, setPaymentMethod] = useState('wire');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [bookingResponse, setBookingResponse] = useState(null); 
  const [formErrors, setFormErrors] = useState([]);
  const [checkoutError, setCheckoutError] = useState(''); 

  const cabinDetails = CABIN_CLASSES[selectedCabin];
  
  const seatCount = passengers.filter(p => p.passengerType !== 'Infant').length;
  const infantCount = passengers.filter(p => p.passengerType === 'Infant').length;
  
  const subtotal = (cabinDetails.price * seatCount) + (200 * infantCount);
  const totalAmount = subtotal;

  const remainingInClass = flightStatus[`${cabinDetails.dbPrefix}_remaining`];
  const isWaitlistSpot = remainingInClass < seatCount;

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
    dob: '', nationality: '', gender: '', passengerType: 'Adult',
    wheelchair: false, meal: 'Standard Kosher' 
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
    if (seatCount === 0) {
      setCheckoutError("A reservation must include at least one Adult or Child occupying a seat.");
      return;
    }
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
            <p className="text-slate-600 mt-1">Class: <strong>{cabinDetails?.name}</strong></p>
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
                        <option value="Infant">Infant Under 2 on Lap ($200)</option>
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
                      <h4 className="text-sm font-bold text-slate-800 mb-3">Special Requests</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                          <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1">Meal Preference</label>
                          <select value={p.meal} name={`meal_${index}`} onChange={(e) => handlePassChange(index, 'meal', e.target.value)} className={`${inputClass(index, 'meal')} bg-white`}>
                            <option value="Standard Kosher">Standard Kosher</option>
                            <option value="Glatt Kosher / Mehadrin">Glatt Kosher / Mehadrin</option>
                            <option value="Kosher Vegetarian">Kosher Vegetarian</option>
                            <option value="Kosher Gluten-Free">Kosher Gluten-Free</option>
                            <option value="Kosher Nut-Free">Kosher Nut-Free</option>
                            <option value="Kosher Child Meal">Kosher Child Meal</option>
                          </select>
                        </div>
                        <div className="flex items-center h-full pt-4 md:pt-6">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={p.wheelchair} onChange={(e) => handlePassChange(index, 'wheelchair', e.target.checked)} className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500" />
                            <span className="text-sm font-medium text-slate-800">Require wheelchair assistance at airport</span>
                          </label>
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

            <div className="bg-blue-50 border border-blue-200 text-blue-900 p-4 rounded-lg text-sm shadow-sm mb-6">
              <p className="font-bold flex items-center gap-2 mb-1"><Info size={16}/> Subject to Demand</p>
              <p>Because this flight operates strictly based on demand, we require payment to secure your seat and verify our minimum passenger count. <strong>If the minimum threshold is not met and the flight does not operate, your payment will be refunded 100%.</strong></p>
            </div>

            <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><CreditCard size={20} className="text-blue-600"/> Payment Options</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              <div onClick={() => setPaymentMethod('cc')} className={`cursor-pointer border-2 rounded-xl p-4 flex flex-col items-center justify-center text-center transition-all ${paymentMethod === 'cc' ? 'border-blue-600 bg-blue-50 shadow-sm' : 'border-slate-200 hover:border-slate-300'}`}>
                <CreditCard size={32} className={`mb-2 ${paymentMethod === 'cc' ? 'text-blue-600' : 'text-slate-400'}`} />
                <h3 className="font-bold">Credit Card (Pending)</h3>
                <p className="text-xs text-slate-500 mt-1">Reserve your spot now. We will notify you to complete payment when the CC gateway is live.</p>
              </div>
              <div onClick={() => setPaymentMethod('wire')} className={`cursor-pointer border-2 rounded-xl p-4 flex flex-col items-center justify-center text-center transition-all ${paymentMethod === 'wire' ? 'border-blue-600 bg-blue-50 shadow-sm' : 'border-slate-200 hover:border-slate-300'}`}>
                <Landmark size={32} className={`mb-2 ${paymentMethod === 'wire' ? 'text-blue-600' : 'text-slate-400'}`} />
                <h3 className="font-bold">Bank Wire</h3>
                <p className="text-xs text-slate-500 mt-1">
                  {isWaitlistSpot ? 'Wire transfer required to hold your position on the waitlist.' : 'To guarantee your seat immediately, payment must be made via wire transfer.'}
                </p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-6 border border-slate-200 mb-8">
              <h3 className="font-bold text-lg border-b border-slate-200 pb-2 mb-4">Order Summary</h3>
              <div className="space-y-2 text-sm text-slate-700 mb-4">
                <div className="flex justify-between">
                  <span>{cabinDetails?.name} {isWaitlistSpot ? 'Waitlist Spot' : 'Seat'} x {seatCount}</span>
                  <span>${(cabinDetails?.price * seatCount).toLocaleString()}</span>
                </div>
                {infantCount > 0 && (
                  <div className="flex justify-between">
                    <span>Lap Infant x {infantCount}</span>
                    <span>${(200 * infantCount).toLocaleString()}</span>
                  </div>
                )}
              </div>
              <div className="flex justify-between text-xl font-extrabold border-t border-slate-200 pt-4">
                <span>Total Due</span>
                <span>${totalAmount.toLocaleString()}</span>
              </div>

              <div className="mt-6 border-t border-slate-200 pt-6">
                {paymentMethod === 'wire' ? (
                  <div className="bg-blue-100 border border-blue-200 text-blue-900 p-4 rounded-lg text-sm shadow-sm">
                    <p className="font-bold mb-1">Wire Transfer Selected</p>
                    <p>Upon clicking "Complete", we will instantly email your reservation receipt and wire instructions to <strong>{passengers[0].email}</strong>. You must initiate the wire within <strong>6 hours</strong> to guarantee your {isWaitlistSpot ? 'waitlist position' : 'reservation'}.</p>
                  </div>
                ) : (
                  <div className="bg-amber-100 border border-amber-200 text-amber-900 p-4 rounded-lg text-sm shadow-sm">
                    <p className="font-bold mb-1 flex items-center gap-1"><AlertCircle size={16}/> Credit Card Hold</p>
                    <p>Upon clicking "Complete", we will hold your reservation and email you the moment our credit card processor is live. <strong>Note: Seats are filled on a first-to-pay basis.</strong> Your seat is not fully guaranteed until payment is complete.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="mb-8">
              <h3 className="font-bold mb-3 flex items-center gap-2"><FileText size={18}/> Terms & Conditions</h3>
              <div className="bg-slate-100 p-4 rounded-lg text-xs text-slate-700 space-y-2 h-32 overflow-y-auto border border-slate-200 mb-4">
                <p><strong>This flight is strictly based on demand.</strong> All ticket purchases are fully refundable if the charter flight does not operate due to lack of minimum passenger count.</p>
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
            
            <h2 className="text-3xl font-extrabold mb-2">{bookingResponse.isWaitlist ? 'Waitlist Spot Held' : 'Reservation Submitted'}</h2>
            
            {paymentMethod === 'wire' ? (
              <p className="text-lg text-slate-600 mb-8 max-w-md mx-auto">
                <strong>Your reservation details and wire instructions have been emailed to {passengers[0].email}.</strong><br/><br/>
                Please complete the transfer within 6 hours to guarantee your seats.
              </p>
            ) : (
              <p className="text-lg text-slate-600 mb-8 max-w-md mx-auto">
                <strong>Your reservation details have been saved!</strong><br/><br/>
                We will email {passengers[0].email} the moment our credit card processor is live. Please note that seats are filled on a first-to-pay basis.
              </p>
            )}

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 max-w-sm mx-auto mb-8 text-left">
              <p className="text-sm text-slate-500 mb-1">Booking Reference</p>
              <p className="text-2xl font-mono font-bold mb-4 tracking-wider text-[#0a192f]">{bookingResponse.ref}</p>
              
              <p className="text-sm text-slate-500 mb-1">{bookingResponse.isWaitlist ? 'Waitlist Spots' : 'Reservation'}</p>
              <p className="font-semibold mb-4">
                {seatCount} x {cabinDetails?.name}
                {infantCount > 0 && <span className="block text-slate-600 font-normal">+ {infantCount} Lap Infant{infantCount > 1 ? 's' : ''}</span>}
              </p>

              <p className="text-sm text-slate-500 mb-2">Status</p>
              <div>
                <p className={`font-semibold border inline-block px-2 py-0.5 rounded text-sm mb-2 ${bookingResponse.isWaitlist ? 'text-amber-700 bg-amber-100 border-amber-200' : 'text-[#0a192f] bg-blue-100 border-blue-200'}`}>
                  {paymentMethod === 'wire' 
                    ? (bookingResponse.isWaitlist ? 'Waitlist — awaiting payment' : 'Reservation Held — awaiting payment')
                    : 'Awaiting Credit Card Gateway'
                  }
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