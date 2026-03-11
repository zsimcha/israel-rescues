import React, { useState, useEffect } from 'react';
import { Plane, ShieldCheck, Clock, Users, ChevronRight, CheckCircle, CreditCard, Lock, AlertCircle, Landmark, HelpCircle, FileText, Check, ChevronDown, ChevronUp, MapPin } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

// --- SUPABASE INITIALIZATION ---
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;

// --- CONSTANTS & CONFIG ---
const FLIGHT_INFO = {
  routeMain: 'Israel to Major European Hub',
  routeSub: 'e.g., LHR, FRA, or CDG',
  dateMain: 'March 18',
  dateSub: '±1 day depending on airspace approval',
  operator: 'Operated by a licensed carrier arranged through Chapman Freeborn',
  aircraft: 'Airbus A340',
  totalSeats: 253
};

const CABIN_CLASSES = {
  economy: { id: 'economy', name: 'Economy Class', price: 2150, features: ['Standard seating', 'Full cabin service', 'Standard boarding'], color: 'bg-slate-600' },
  premium: { id: 'premium', name: 'Economy+', price: 2350, features: ['Front section seating', 'Priority boarding', 'Expedited deplaning'], color: 'bg-indigo-600' },
  business: { id: 'business', name: 'Business', price: 4500, features: ['Lie-flat seating', 'Priority boarding', 'Premium cabin service'], color: 'bg-blue-900' }
};

const COUNTRY_CODES = [
  { code: '+1', label: 'US/CA (+1)' },
  { code: '+972', label: 'IL (+972)' },
  { code: '+44', label: 'UK (+44)' },
  { code: '+33', label: 'FR (+33)' },
  { code: '+49', label: 'DE (+49)' },
  { code: '+61', label: 'AU (+61)' },
  { code: '+00', label: 'Other' }
];

export default function App() {
  const [user, setUser] = useState(null);
  const [authInitialized, setAuthInitialized] = useState(false);
  const [view, setView] = useState('landing');
  const [selectedCabin, setSelectedCabin] = useState('economy');
  
  const [bookedSeatsCount, setBookedSeatsCount] = useState(0);
  const [loadingData, setLoadingData] = useState(true);

  // Supabase Auth Setup
  useEffect(() => {
    if (!supabase) {
      console.error("Supabase credentials missing! Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env.local file.");
      setAuthInitialized(true);
      setLoadingData(false);
      return;
    }

    const initAuth = async () => {
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) {
        console.error("Auth Error:", error.message);
      } else {
        setUser(data.user);
      }
      setAuthInitialized(true);
    };
    initAuth();
  }, []);

  // Supabase Data Fetching (Seat Count)
  useEffect(() => {
    if (!supabase || !user) return;

    const fetchInitialCount = async () => {
      const { data, error } = await supabase.from('seat_counts').select('count');
      if (error) {
        console.error("Error fetching seats:", error);
      } else if (data) {
        const total = data.reduce((sum, row) => sum + row.count, 0);
        setBookedSeatsCount(total);
      }
      setLoadingData(false);
    };

    fetchInitialCount();

    const channel = supabase.channel('seat_counts_updates')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'seat_counts' }, payload => {
        setBookedSeatsCount(current => current + payload.new.count);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const handleSelectCabin = (cabinId) => {
    setSelectedCabin(cabinId);
    setView('booking');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const seatsAvailable = Math.max(0, FLIGHT_INFO.totalSeats - bookedSeatsCount);

  if (!authInitialized || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  if (!supabase) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 text-center">
        <div className="max-w-md bg-white p-6 rounded-lg shadow-md border border-red-200">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Supabase Configuration Missing</h2>
          <p className="text-slate-600 mb-4">You need to add your Supabase URL and Anon Key to a <code>.env.local</code> file in your project folder to run this site.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-blue-100 flex flex-col">
      <Navbar setView={setView} />
      <main className="flex-grow">
        {view === 'landing' && (
          <LandingView onSelectCabin={handleSelectCabin} seatsAvailable={seatsAvailable} />
        )}
        {view === 'booking' && (
          <BookingFlow setView={setView} selectedCabin={selectedCabin} user={user} supabase={supabase} />
        )}
      </main>
      <Footer />
    </div>
  );
}

// --- COMPONENTS ---

function Navbar({ setView }) {
  return (
    <nav className="bg-[#0a192f] text-white sticky top-0 z-50 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => { setView('landing'); window.scrollTo(0,0); }}>
            <Plane className="h-6 w-6 text-blue-400" />
            <span className="font-bold text-xl tracking-tight">Israel Rescues</span>
          </div>
          <div className="text-sm font-medium text-slate-300 hidden sm:block">
            Help@IsraelRescues.com
          </div>
        </div>
      </div>
    </nav>
  );
}

function LandingView({ onSelectCabin, seatsAvailable }) {
  const [openFaq, setOpenFaq] = useState(null);

  const toggleFaq = (index) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const faqs = [
    { q: "When will the flight be confirmed?", a: "The flight will be confirmed once sufficient seats are reserved and the aircraft contract is finalized. We expect this to be a minimum of 2-3 days before departure." },
    { q: "When will I know the exact departure time?", a: "Passengers will receive a confirmation email with the exact departure time once the aircraft is secured and regulatory approvals are finalized." },
    { q: "Can I get a refund?", a: "Yes. If the flight does not operate, you will receive a full refund minus payment processing fees." },
    { q: "Will families sit together?", a: "Yes. Families and groups booking together will be seated together whenever possible." }
  ];

  return (
    <div className="animate-in fade-in duration-500 pb-16">
      <div className="relative bg-[#0a192f] text-white py-16 sm:py-20 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img 
            src="https://images.unsplash.com/photo-1540962351504-03099e0a754b?q=80&w=2000&auto=format&fit=crop" 
            alt="Widebody Aircraft" 
            className="w-full h-full object-cover opacity-25"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0a192f] via-[#0a192f]/80 to-transparent"></div>
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-500/30 text-blue-200 text-sm font-medium mb-6">
            <Plane size={16} /> Emergency Charter Flight
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight mb-4 max-w-3xl">
            Israel to Europe <br className="hidden sm:block"/> Charter Flight
          </h1>
          <p className="text-lg sm:text-xl text-slate-300 max-w-2xl mb-8 leading-relaxed">
            {FLIGHT_INFO.operator}. Direct charter flight providing immediate outbound travel.
          </p>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 max-w-4xl">
            <div className="bg-white/10 p-4 rounded-lg border border-white/20 backdrop-blur-md">
              <p className="text-slate-300 text-sm mb-1">Target Departure</p>
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
              <p className="font-bold text-xl text-blue-300">{seatsAvailable} Seats Remaining</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white py-8 border-b border-slate-200 shadow-sm relative z-20 -mt-4 mx-4 sm:mx-8 lg:mx-auto max-w-7xl rounded-xl px-4 sm:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
          <div className="flex gap-3 items-start">
            <div className="bg-green-100 p-2 rounded-full text-green-600 shrink-0"><ShieldCheck size={20} /></div>
            <div>
              <h3 className="font-bold text-base mb-1 text-slate-900">100% Refundable</h3>
              <p className="text-slate-600">All ticket purchases are fully refundable if the flight does not operate.</p>
            </div>
          </div>
          <div className="flex gap-3 items-start">
            <div className="bg-blue-100 p-2 rounded-full text-blue-600 shrink-0"><CheckCircle size={20} /></div>
            <div>
              <h3 className="font-bold text-base mb-1 text-slate-900">Instant Reservation</h3>
              <p className="text-slate-600">Seats are reserved once payment is received. Exact date and destination confirmed 2-3 days before departure.</p>
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
          {Object.values(CABIN_CLASSES).map((cabin) => (
            <div key={cabin.id} className={`bg-white rounded-xl shadow-sm border-2 overflow-hidden flex flex-col ${cabin.id === 'business' ? 'border-blue-900 shadow-lg' : 'border-slate-200'}`}>
              <div className={`${cabin.color} text-white px-6 py-4 flex justify-between items-center`}>
                <h3 className="text-xl font-bold">{cabin.name}</h3>
                <div className="text-right">
                  <span className="text-2xl font-extrabold">${cabin.price.toLocaleString()}</span>
                  <span className="text-sm opacity-80 block">/ seat</span>
                </div>
              </div>
              <div className="p-6 flex-grow">
                <ul className="space-y-3 mb-8">
                  {cabin.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2 text-slate-700">
                      <CheckCircle size={18} className={`${cabin.id === 'business' ? 'text-blue-600' : 'text-slate-400'}`} /> {feature}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="p-6 pt-0 mt-auto">
                <button 
                  onClick={() => onSelectCabin(cabin.id)}
                  className={`w-full py-3 rounded-lg font-bold transition-all shadow hover:shadow-md flex items-center justify-center gap-2
                    ${cabin.id === 'business' ? 'bg-blue-900 text-white hover:bg-blue-800' : 'bg-slate-900 text-white hover:bg-slate-800'}`}
                >
                  Select {cabin.name} <ChevronRight size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Section: Why This Charter Flight */}
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
              <p className="text-sm text-slate-600">Arrive at a major European hub for easy onward flights to international destinations.</p>
            </div>
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center text-center">
              <div className="bg-blue-50 p-3 rounded-full mb-4"><Users size={24} className="text-blue-600" /></div>
              <h4 className="font-bold text-slate-900 mb-2">Organized coordination</h4>
              <p className="text-sm text-slate-600">Arranged through Chapman Freeborn, a global aircraft charter specialist.</p>
            </div>
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center text-center">
              <div className="bg-blue-50 p-3 rounded-full mb-4"><ShieldCheck size={24} className="text-blue-600" /></div>
              <h4 className="font-bold text-slate-900 mb-2">Widebody aircraft comfort</h4>
              <p className="text-sm text-slate-600">Operated on a widebody aircraft with both business and economy cabins.</p>
            </div>
          </div>
          <p className="text-center text-sm mt-6 text-slate-500 italic px-4 max-w-3xl mx-auto">
            Frankfurt, London and Paris are some of Europe's largest aviation hubs, offering dozens of daily flights to North America and other international destinations.
          </p>
        </div>

        {/* Section: Important Info & Legal */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16">
          <div className="bg-amber-50 p-8 rounded-xl border border-amber-200 text-amber-900 shadow-sm">
            <h2 className="text-2xl font-bold flex items-center gap-2 mb-4"><AlertCircle size={24} className="text-amber-600"/> Important Info</h2>
            <div className="space-y-4 text-sm">
              <p><strong>Destination:</strong> The final destination airport will be confirmed once the aircraft is secured and regulatory approvals are received. The intended destination is Frankfurt or London.</p>
              <p><strong>Onward Travel:</strong> Passengers should <strong>not</strong> book onward travel until the charter flight is fully confirmed.</p>
              <p><strong>Availability:</strong> Due to high demand, reservations may be limited and availability cannot be guaranteed until payment is completed.</p>
            </div>
          </div>
          
          <div className="bg-slate-100 p-8 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center">
            <h2 className="text-2xl font-bold flex items-center gap-2 mb-4"><FileText size={24} className="text-slate-600"/> Legal Notice</h2>
            <div className="text-sm text-slate-600 space-y-4 leading-relaxed">
              <p>
                This is a privately organized charter flight arranged through a licensed aircraft charter broker.
              </p>
              <p>
                * If the charter flight cannot be operated for any reason, passengers will receive a full refund of the ticket price, less any non-refundable payment processing fees charged by the payment provider (typically ~3%). Once the aircraft is confirmed and the flight is scheduled, tickets become non-refundable except in the event the flight is cancelled.
              </p>
            </div>
          </div>
        </div>

        {/* Section: FAQs */}
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold flex justify-center items-center gap-2 mb-8 text-[#0a192f]"><HelpCircle size={28} className="text-blue-600"/> Frequently Asked Questions</h2>
          <div className="space-y-3">
            {faqs.map((faq, idx) => (
              <div key={idx} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden transition-all">
                <button 
                  onClick={() => toggleFaq(idx)}
                  className="w-full px-6 py-4 text-left font-bold text-slate-900 flex justify-between items-center hover:bg-slate-50"
                >
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

function BookingFlow({ setView, selectedCabin, user, supabase }) {
  const [step, setStep] = useState(1);
  const [passengers, setPassengers] = useState([{ 
    firstName: '', middleName: '', lastName: '', 
    email: '', phoneCode: '+1', phone: '', 
    emergencyName: '', emergencyPhoneCode: '+1', emergencyPhone: '', 
    passport: '', passportExpiry: '', dob: '', nationality: '', gender: '' 
  }]);
  
  const [paymentMethod, setPaymentMethod] = useState('cc');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [bookingRef, setBookingRef] = useState('');
  const [formErrors, setFormErrors] = useState([]);

  const cabinDetails = CABIN_CLASSES[selectedCabin];
  const subtotal = cabinDetails.price * passengers.length;
  const ccFee = Math.round(subtotal * 0.03);
  const totalAmount = paymentMethod === 'cc' ? subtotal + ccFee : subtotal;

  const handlePassChange = (index, field, value) => {
    const newPass = [...passengers];
    
    if (field === 'phone' || field === 'emergencyPhone') {
      value = value.replace(/[^\d\-\s()]/g, '');
    }
    
    newPass[index][field] = value;
    setPassengers(newPass);
    setFormErrors(formErrors.filter(e => !(e.index === index && e.field === field)));
  };

  const addPassenger = () => {
    setPassengers([...passengers, { 
      firstName: '', middleName: '', lastName: '', 
      email: '', phoneCode: '+1', phone: '', 
      emergencyName: '', emergencyPhoneCode: '+1', emergencyPhone: '', 
      passport: '', passportExpiry: '', dob: '', nationality: '', gender: '' 
    }]);
  };
  
  const removePassenger = (index) => {
    if (passengers.length > 1) {
      setPassengers(passengers.filter((_, i) => i !== index));
      setFormErrors(formErrors.filter(e => e.index !== index));
    }
  };

  const validateStep1 = () => {
    let errors = [];
    passengers.forEach((p, i) => {
      if (!p.firstName.trim()) errors.push({ index: i, field: 'firstName', msg: 'First Name is required' });
      if (!p.lastName.trim()) errors.push({ index: i, field: 'lastName', msg: 'Last Name is required' });
      if (!p.email.includes('@')) errors.push({ index: i, field: 'email', msg: 'Valid Email is required' });
      if (p.phone.replace(/\D/g, '').length < 7) errors.push({ index: i, field: 'phone', msg: 'Valid Phone is required' });
      if (!p.emergencyName.trim()) errors.push({ index: i, field: 'emergencyName', msg: 'Emergency Contact Name required' });
      if (p.emergencyPhone.replace(/\D/g, '').length < 7) errors.push({ index: i, field: 'emergencyPhone', msg: 'Emergency Contact Phone required' });
      if (!p.passport.trim()) errors.push({ index: i, field: 'passport', msg: 'Passport Number required' });
      if (!p.passportExpiry) errors.push({ index: i, field: 'passportExpiry', msg: 'Passport Expiry required' });
      if (!p.dob) errors.push({ index: i, field: 'dob', msg: 'Date of Birth required' });
      if (!p.nationality.trim()) errors.push({ index: i, field: 'nationality', msg: 'Nationality required' });
      if (!p.gender) errors.push({ index: i, field: 'gender', msg: 'Gender required' });
    });
    setFormErrors(errors);
    return errors.length === 0;
  };

  const handleContinueToPayment = () => {
    if (validateStep1()) {
      setStep(2);
      window.scrollTo(0,0);
    } else {
      alert("Please complete all required fields highlighted in red.");
    }
  };

  const handleCheckout = async (e) => {
    e.preventDefault();
    if (!agreedToTerms) {
      alert("You must agree to the Terms & Conditions to proceed.");
      return;
    }
    
    setIsProcessing(true);

    try {
      const { data: bookingData, error: bookingError } = await supabase
        .from('bookings')
        .insert([
          {
            user_id: user.id,
            passengers: passengers,
            cabin_class: selectedCabin,
            total_paid: paymentMethod === 'cc' ? totalAmount : 0, 
            payment_method: paymentMethod,
            status: paymentMethod === 'cc' ? 'confirmed' : 'awaiting_wire'
          }
        ])
        .select();

      if (bookingError) throw bookingError;

      const newBookingId = bookingData[0].id;

      const { error: countError } = await supabase
        .from('seat_counts')
        .insert([
          {
            booking_id: newBookingId,
            count: passengers.length
          }
        ]);

      if (countError) throw countError;
      
      setBookingRef(newBookingId.split('-')[0].toUpperCase());
      setStep(3);
      window.scrollTo(0,0);

    } catch (error) {
      console.error("Booking error:", error);
      alert("An error occurred while processing your booking. Please check your connection and try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const hasError = (index, field) => formErrors.some(e => e.index === index && e.field === field);

  const inputClass = (index, field) => `w-full border rounded-md p-2.5 outline-none focus:ring-2 focus:ring-blue-500 ${hasError(index, field) ? 'border-red-500 bg-red-50' : 'border-slate-300'}`;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in slide-in-from-bottom-4 duration-500">
      
      <div className="mb-8">
        <button onClick={() => { setView('landing'); window.scrollTo(0,0); }} className="text-blue-600 font-medium hover:underline mb-6 inline-flex items-center gap-1">
          &larr; Back to Flight Details
        </button>
        <div className="flex justify-between items-end border-b border-slate-200 pb-4">
          <div>
            <h1 className="text-3xl font-bold">Secure Checkout</h1>
            <p className="text-slate-600 mt-1">Class: <strong>{cabinDetails.name}</strong> (${cabinDetails.price.toLocaleString()}/seat)</p>
          </div>
          <div className="text-right hidden sm:block">
            <div className="text-sm text-slate-500">Subtotal</div>
            <div className="text-2xl font-extrabold">${subtotal.toLocaleString()}</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        
        {step === 1 && (
          <div className="p-6 sm:p-8">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><Users size={20} className="text-blue-600"/> Passenger Information</h2>
            
            {formErrors.length > 0 && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center gap-2 text-sm font-medium">
                <AlertCircle size={18} /> Please fill out all required fields marked in red.
              </div>
            )}

            <div className="space-y-8">
              {passengers.map((p, index) => (
                <div key={index} className="bg-slate-50 border border-slate-200 rounded-lg p-5 relative">
                  {index > 0 && (
                    <button onClick={() => removePassenger(index)} className="absolute top-4 right-4 text-red-500 text-sm font-bold hover:underline">
                      Remove
                    </button>
                  )}
                  <h3 className="font-semibold text-lg mb-4 text-slate-800 border-b border-slate-200 pb-2">Passenger {index + 1}</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1">First Name *</label>
                      <input type="text" value={p.firstName} name={`firstName_${index}`} autoComplete="given-name" onChange={(e) => handlePassChange(index, 'firstName', e.target.value)} className={inputClass(index, 'firstName')} required/>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1">Middle Name</label>
                      <input type="text" value={p.middleName} name={`middleName_${index}`} autoComplete="additional-name" onChange={(e) => handlePassChange(index, 'middleName', e.target.value)} className={inputClass(index, 'middleName')} placeholder="(Optional)" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1">Last Name *</label>
                      <input type="text" value={p.lastName} name={`lastName_${index}`} autoComplete="family-name" onChange={(e) => handlePassChange(index, 'lastName', e.target.value)} className={inputClass(index, 'lastName')} required/>
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
                    
                    <div>
                      <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1">Passport Number *</label>
                      <input type="text" value={p.passport} name={`passport_${index}`} onChange={(e) => handlePassChange(index, 'passport', e.target.value)} className={inputClass(index, 'passport')} required/>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1">Passport Expiration *</label>
                      <input type="date" value={p.passportExpiry} name={`passportExpiry_${index}`} onChange={(e) => handlePassChange(index, 'passportExpiry', e.target.value)} className={inputClass(index, 'passportExpiry')} required/>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1">Date of Birth *</label>
                      <input type="date" value={p.dob} name={`dob_${index}`} autoComplete="bday" onChange={(e) => handlePassChange(index, 'dob', e.target.value)} className={inputClass(index, 'dob')} required/>
                    </div>
                    
                    <div>
                      <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1">Nationality *</label>
                      <input type="text" value={p.nationality} name={`nationality_${index}`} autoComplete="country-name" onChange={(e) => handlePassChange(index, 'nationality', e.target.value)} className={inputClass(index, 'nationality')} placeholder="e.g. USA" required/>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1">Gender *</label>
                      <select value={p.gender} name={`gender_${index}`} autoComplete="sex" onChange={(e) => handlePassChange(index, 'gender', e.target.value)} className={`${inputClass(index, 'gender')} bg-white`} required>
                        <option value="">Select</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                      </select>
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
              <button 
                onClick={handleContinueToPayment}
                className="w-full sm:w-auto bg-[#0a192f] text-white px-8 py-3 rounded-lg font-bold hover:bg-slate-800 transition-colors"
              >
                Continue to Payment
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <form onSubmit={handleCheckout} className="p-6 sm:p-8 animate-in fade-in">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><CreditCard size={20} className="text-blue-600"/> Payment Options</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              <div 
                onClick={() => setPaymentMethod('cc')}
                className={`cursor-pointer border-2 rounded-xl p-4 flex flex-col items-center justify-center text-center transition-all ${paymentMethod === 'cc' ? 'border-blue-600 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}
              >
                <CreditCard size={32} className={`mb-2 ${paymentMethod === 'cc' ? 'text-blue-600' : 'text-slate-400'}`} />
                <h3 className="font-bold">Credit Card</h3>
                <p className="text-xs text-slate-500 mt-1">Instant confirmation. 3% processing fee applies.</p>
              </div>
              <div 
                onClick={() => setPaymentMethod('wire')}
                className={`cursor-pointer border-2 rounded-xl p-4 flex flex-col items-center justify-center text-center transition-all ${paymentMethod === 'wire' ? 'border-blue-600 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}
              >
                <Landmark size={32} className={`mb-2 ${paymentMethod === 'wire' ? 'text-blue-600' : 'text-slate-400'}`} />
                <h3 className="font-bold">Bank Wire</h3>
                <p className="text-xs text-slate-500 mt-1">No fees. Must be wired within 6 hours to confirm seat.</p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-6 border border-slate-200 mb-8">
              <h3 className="font-bold text-lg border-b border-slate-200 pb-2 mb-4">Order Summary</h3>
              <div className="space-y-2 text-sm text-slate-700 mb-4">
                <div className="flex justify-between">
                  <span>{cabinDetails.name} Seat x {passengers.length}</span>
                  <span>${subtotal.toLocaleString()}</span>
                </div>
                {paymentMethod === 'cc' && (
                  <div className="flex justify-between text-slate-500">
                    <span>Credit Card Processing Fee (3%)</span>
                    <span>${ccFee.toLocaleString()}</span>
                  </div>
                )}
              </div>
              <div className="flex justify-between text-xl font-extrabold border-t border-slate-200 pt-4">
                <span>Total Due</span>
                <span>${totalAmount.toLocaleString()}</span>
              </div>

              {paymentMethod === 'cc' && (
                <div className="mt-6 border-t border-slate-200 pt-6">
                  <div className="flex justify-between items-center mb-4">
                    <span className="font-semibold text-sm">Card & Billing Details</span>
                    <Lock size={14} className="text-slate-400" />
                  </div>
                  
                  <div className="border border-slate-300 rounded-md overflow-hidden bg-white focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent transition-all mb-4">
                    <input type="text" placeholder="Card number" name="cc-number" autoComplete="cc-number" className="w-full p-3 outline-none border-b border-slate-200 text-sm" required pattern="\d*" maxLength="16" />
                    <div className="flex">
                      <input type="text" placeholder="MM / YY" name="cc-exp" autoComplete="cc-exp" className="w-1/2 p-3 outline-none border-r border-slate-200 text-sm" required maxLength="5" />
                      <input type="text" placeholder="CVC" name="cc-csc" autoComplete="cc-csc" className="w-1/2 p-3 outline-none text-sm" required maxLength="4" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-2">
                    <div className="sm:col-span-2">
                      <input type="text" placeholder="Name on Card" name="cc-name" autoComplete="cc-name" className="w-full border border-slate-300 rounded-md p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white" required defaultValue={`${passengers[0].firstName} ${passengers[0].lastName}`} />
                    </div>
                    <div className="sm:col-span-2">
                      <input type="text" placeholder="Billing Address" name="street-address" autoComplete="street-address" className="w-full border border-slate-300 rounded-md p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white" required />
                    </div>
                    <div>
                      <input type="text" placeholder="City" name="address-level2" autoComplete="address-level2" className="w-full border border-slate-300 rounded-md p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white" required />
                    </div>
                    <div>
                      <input type="text" placeholder="ZIP / Postal Code" name="postal-code" autoComplete="postal-code" className="w-full border border-slate-300 rounded-md p-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white" required />
                    </div>
                  </div>
                  
                  <p className="text-[10px] text-slate-500 text-center mt-3">Payments are secure and encrypted. Refundable if flight does not operate.</p>
                </div>
              )}

              {paymentMethod === 'wire' && (
                <div className="mt-6 border-t border-slate-200 pt-6">
                  <div className="bg-blue-100 border border-blue-200 text-blue-900 p-4 rounded-lg text-sm">
                    <p className="font-bold mb-1">Wire Transfer Selected</p>
                    <p>Upon clicking "Complete Reservation", we will instantly email wire instructions to <strong>{passengers[0].email}</strong>. You must initiate the wire within <strong>6 hours</strong> to guarantee your seats on this flight.</p>
                  </div>
                </div>
              )}
            </div>

            <div className="mb-8">
              <h3 className="font-bold mb-3 flex items-center gap-2"><FileText size={18}/> Terms & Conditions</h3>
              <div className="bg-slate-100 p-4 rounded-lg text-xs text-slate-700 space-y-2 h-32 overflow-y-auto border border-slate-200 mb-4">
                <p>By purchasing a ticket you acknowledge that:</p>
                <ul className="list-disc pl-4 space-y-1">
                  <li>This is a privately organized charter flight.</li>
                  <li>The flight will operate once the aircraft is secured and approvals are received.</li>
                  <li>The destination airport may change based on operational considerations.</li>
                  <li>Passengers are responsible for any onward travel arrangements.</li>
                  <li>Tickets become non-refundable once the charter flight is confirmed.</li>
                  <li>If the flight does not operate, passengers will receive a full refund minus payment processing fees.</li>
                </ul>
              </div>
              <label className="flex items-start gap-3 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={agreedToTerms} 
                  onChange={(e) => setAgreedToTerms(e.target.checked)} 
                  className="mt-1 w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500" 
                />
                <span className="text-sm font-medium text-slate-800">
                  I agree to the Terms & Conditions.
                </span>
              </label>
            </div>

            <div className="flex justify-between items-center border-t border-slate-200 pt-6">
              <button type="button" onClick={() => setStep(1)} className="text-slate-500 font-medium hover:text-slate-800 px-4 py-2">
                &larr; Back
              </button>
              <button 
                type="submit" 
                disabled={isProcessing || !agreedToTerms}
                className="bg-[#0a192f] text-white px-8 py-3 rounded-lg font-bold hover:bg-slate-800 disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                {isProcessing ? (
                  <><div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div> Processing...</>
                ) : (
                  paymentMethod === 'cc' ? `Pay $${totalAmount.toLocaleString()}` : 'Complete Reservation'
                )}
              </button>
            </div>
          </form>
        )}

        {step === 3 && (
          <div className="text-center py-16 px-6 animate-in zoom-in-95 duration-500">
            <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle size={40} />
            </div>
            <h2 className="text-3xl font-extrabold mb-2">Reservation Secured</h2>
            
            {paymentMethod === 'cc' ? (
              <p className="text-lg text-slate-600 mb-8 max-w-md mx-auto">
                Your payment has been processed and a receipt has been emailed to {passengers[0].email}.
              </p>
            ) : (
              <p className="text-lg text-slate-600 mb-8 max-w-md mx-auto">
                Your reservation is held. <strong>Wire instructions have been emailed to {passengers[0].email}.</strong> Please complete the transfer within 6 hours.
              </p>
            )}

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 max-w-sm mx-auto mb-8 text-left">
              <p className="text-sm text-slate-500 mb-1">Booking Reference</p>
              <p className="text-2xl font-mono font-bold mb-4 tracking-wider text-[#0a192f]">{bookingRef}</p>
              
              <p className="text-sm text-slate-500 mb-1">Seats Reserved</p>
              <p className="font-semibold mb-4">{passengers.length} x {cabinDetails.name}</p>

              <p className="text-sm text-slate-500 mb-2">Status</p>
              {paymentMethod === 'cc' ? (
                <div>
                  <p className="font-semibold text-green-700 bg-green-100 border border-green-200 inline-block px-2 py-0.5 rounded text-sm">Seat Reserved</p>
                  <p className="text-xs text-slate-500 mt-2 leading-tight">Your seat has been reserved on the upcoming charter flight. Final departure timing will be confirmed once Israeli airspace clearance is received.</p>
                </div>
              ) : (
                <p className="font-semibold text-red-600 bg-red-100 inline-block px-2 py-0.5 rounded text-sm">Awaiting Wire Transfer</p>
              )}
            </div>

            <p className="text-sm text-slate-500 mb-8 max-w-md mx-auto">
              If you have any questions or need to make adjustments to your passport information, please contact <strong>Help@IsraelRescues.com</strong>.
            </p>

            <button onClick={() => { setView('landing'); window.scrollTo(0,0); }} className="bg-[#0a192f] text-white px-8 py-3 rounded-lg font-bold hover:bg-slate-800 transition-colors">
              Return to Homepage
            </button>
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
            <p className="text-xs text-slate-600">This is a privately organized charter flight arranged through a licensed aircraft charter broker.</p>
          </div>
          <div className="text-center md:text-right text-sm">
            <p className="mb-1">Contact: <a href="mailto:Help@IsraelRescues.com" className="text-blue-400 hover:underline">Help@IsraelRescues.com</a></p>
            <p className="text-slate-500">&copy; {new Date().getFullYear()} Rescue Charters LLC. All rights reserved.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}