"use client";

import { useState, useEffect, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@repo/ui/button';
import { Input } from '@repo/ui/input';
import { Label } from '@repo/ui/label';
import { PhoneInput, type PhoneInputValue } from '@repo/ui/phone-input';
import { Calendar, Eye, EyeOff, Map as MapIcon, Gift, MapPin, ShieldCheck, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { NEXT_PUBLIC_GOOGLE_MAPS_API_KEY } from '@repo/config/config';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@repo/ui/dialog';
// import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@repo/ui/dialog';
import { validateLocalNumber } from '@repo/lib/utils/phoneUtils';

const rawApiKey = NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
const GOOGLE_MAPS_API_KEY = rawApiKey.toString().trim().replace(/['"“”]/g, '');

interface GooglePlacesResult {
  description: string;
  place_id: string;
}

function ClientRegisterForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneValue, setPhoneValue] = useState<PhoneInputValue>({ countryCode: '91', phone: '' });
  const [gender, setGender] = useState('');
  const [birthdayDate, setBirthdayDate] = useState('');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [address, setAddress] = useState('');
  const [state, setState] = useState('');
  const [city, setCity] = useState('');
  const [pincode, setPincode] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Extract referral code from URL on component mount
  useEffect(() => {
    const refCode = searchParams.get('ref');
    if (refCode) {
      setReferralCode(refCode);
      toast.success('Referral code applied!', {
        description: `You're signing up with referral code: ${refCode}`
      });
    }
  }, [searchParams]);

  // Map functionality states
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GooglePlacesResult[]>([]);
  const [authError, setAuthError] = useState(false);
  const [isGoogleMapsLoaded, setIsGoogleMapsLoaded] = useState(false);
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const map = useRef<google.maps.Map | null>(null);
  const marker = useRef<google.maps.Marker | null>(null);
  const geocoder = useRef<google.maps.Geocoder | null>(null);
  const autocompleteService = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesService = useRef<google.maps.places.PlacesService | null>(null);
  const [showRegistrationForm, setShowRegistrationForm] = useState(false);

  const [isEmailOtpSent, setIsEmailOtpSent] = useState(false);
  const [emailOtp, setEmailOtp] = useState('');
  const [isEmailVerified, setIsEmailVerified] = useState(false);

  const [isPhoneOtpSent, setIsPhoneOtpSent] = useState(false);
  const [phoneOtp, setPhoneOtp] = useState('');
  const [isPhoneVerified, setIsPhoneVerified] = useState(false);

  const [isOtpLoading, setIsOtpLoading] = useState(false);
  const [phoneOtpAttemptedNumber, setPhoneOtpAttemptedNumber] = useState('');  // tracks countryCode+phone to prevent duplicate auto-sends

  // New state to track confirmed location
  const [confirmedLocation, setConfirmedLocation] = useState<{ lat: number; lng: number } | null>(null);

  const handleSendEmailOtp = async () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error('Please enter a valid email address');
      return;
    }
    setIsOtpLoading(true);
    try {
      const res = await fetch(`/api/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      if (res.ok) {
        setIsEmailOtpSent(true);
        toast.success('OTP sent to your email');
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to send OTP.');
      }
    } catch (error) {
      toast.error('Network error.');
    } finally {
      setIsOtpLoading(false);
    }
  };

  const handleVerifyEmailOtp = async () => {
    if (!emailOtp || emailOtp.length !== 6) {
      toast.error('Please enter a valid 6-digit OTP');
      return;
    }
    setIsOtpLoading(true);
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp: emailOtp })
      });
      if (res.ok) {
        setIsEmailVerified(true);
        toast.success('Email verified successfully');
      } else {
        const data = await res.json();
        toast.error(data.error || 'Invalid OTP');
        setEmailOtp('');
      }
    } catch (error) {
      toast.error('Network error.');
    } finally {
      setIsOtpLoading(false);
    }
  };

  const handleSendPhoneOtp = async () => {
    const { countryCode, phone } = phoneValue;
    if (!phone || phone.length < 5) {
      toast.error('Please enter a valid phone number');
      return;
    }
    // India-specific: require exactly 10 digits
    if (countryCode === '91' && phone.length !== 10) {
      toast.error('Please enter a valid 10-digit Indian mobile number');
      return;
    }
    setIsOtpLoading(true);
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, countryCode }),
      });
      const data = await res.json();
      if (data.success) {
        setIsPhoneOtpSent(true);
        toast.success(data.message || 'OTP sent to your mobile number');
      } else {
        toast.error(data.message || 'Failed to send OTP');
      }
    } catch (err) {
      toast.error('Network error. Please try again.');
    } finally {
      setIsOtpLoading(false);
    }
  };

  const handleVerifyPhoneOtp = async () => {
    if (!phoneOtp || phoneOtp.length < 6) {
      toast.error('Please enter a valid 6-digit OTP');
      return;
    }
    setIsOtpLoading(true);
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneValue.phone, countryCode: phoneValue.countryCode, otp: phoneOtp }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Phone verified successfully!');
        setIsPhoneVerified(true);
      } else {
        toast.error(data.message || 'Invalid OTP');
        setPhoneOtp('');
      }
    } catch (err) {
      toast.error('Network error. Please try again.');
    } finally {
      setIsOtpLoading(false);
    }
  };

  // Auto-send Phone OTP when 10 digits are reached (India default behaviour)
  const phoneKey = `${phoneValue.countryCode}:${phoneValue.phone}`;
  useEffect(() => {
    const { countryCode, phone } = phoneValue;
    const isIndiaFull = countryCode === '91' && phone.length === 10;
    if (isIndiaFull && phoneOtpAttemptedNumber !== phoneKey && !isPhoneVerified && !isOtpLoading) {
      setPhoneOtpAttemptedNumber(phoneKey);
      handleSendPhoneOtp();
    }
  }, [phoneValue, phoneOtpAttemptedNumber, isPhoneVerified, isOtpLoading]);

  // Auto-verify Phone OTP when 6 digits are reached
  useEffect(() => {
    if (phoneOtp.length === 6 && !isPhoneVerified && !isOtpLoading) {
      handleVerifyPhoneOtp();
    }
  }, [phoneOtp, isPhoneVerified, isOtpLoading]);

  // Auto-verify Email OTP when 6 digits are reached
  useEffect(() => {
    if (emailOtp.length === 6 && !isEmailVerified && !isOtpLoading) {
      handleVerifyEmailOtp();
    }
  }, [emailOtp, isEmailVerified, isOtpLoading]);

  const handleProceedToForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (isPhoneVerified) {
      setShowRegistrationForm(true);
    } else if (!isPhoneOtpSent) {
      handleSendPhoneOtp();
    } else {
      handleVerifyPhoneOtp();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check each required field individually and provide specific error messages
    const missingFields = [];

    if (!firstName) missingFields.push('First name');
    if (!lastName) missingFields.push('Last name');
    if (!email) missingFields.push('Email');
    if (!phoneValue.phone) missingFields.push('Mobile number');
    if (!confirmedLocation) missingFields.push('Location');
    if (!state) missingFields.push('State');
    if (!city) missingFields.push('City');
    if (!pincode) missingFields.push('Pincode');
    if (!password) missingFields.push('Password');
    if (!confirmPassword) missingFields.push('Confirm password');

    if (missingFields.length > 0) {
      const errorMessage = `Please fill in the following required fields: ${missingFields.join(', ')}`;
      toast.error(errorMessage);
      return;
    }

    if (!isEmailVerified) {
      toast.error('Please verify your email address with OTP before continuing');
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      const errorMessage = 'Please enter a valid email address';
      toast.error(errorMessage);
      return;
    }

    // Mobile number validation
    const phoneValidation = validateLocalNumber(phoneValue.phone, phoneValue.countryCode);
    if (!phoneValidation.valid) {
      toast.error(phoneValidation.error || 'Please enter a valid phone number');
      return;
    }

    // Password validation - must be at least 8 characters
    if (password.length < 8) {
      const errorMessage = 'Password must be at least 8 characters long';
      toast.error(errorMessage);
      return;
    }

    // Basic validation
    if (password !== confirmPassword) {
      const errorMessage = 'Passwords do not match';
      toast.error(errorMessage);
      return;
    }

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          mobileNo: phoneValue.phone,
          countryCode: phoneValue.countryCode,
          location: confirmedLocation,
          address,
          state,
          city,
          pincode,
          referralCode,
          password,
          gender,
          birthdayDate
        }),
      });

      // Check if response is OK and has content
      if (res.ok) {
        toast.success(`${firstName} ${lastName} registered successfully!`);
        router.push('/client-login');
      } else {
        // Try to parse JSON, but handle case where there's no JSON
        let errorMessage = 'Failed to sign up.';
        try {
          const data = await res.json();
          errorMessage = data.message || errorMessage;
        } catch (jsonError) {
          // If JSON parsing fails, use status text or generic message
          errorMessage = res.statusText || errorMessage;
        }

        // If the error is about email already existing, automatically redirect to step 1
        if (errorMessage.includes('already registered') || errorMessage.includes('already exist')) {
          const toastId = toast.error(errorMessage);
          // Automatically redirect to step 1 after a short delay and dismiss the toast
          setTimeout(() => {
            toast.dismiss(toastId);
            setShowRegistrationForm(false);
          }, 2000);
        } else {
          toast.error(errorMessage);
        }
      }
    } catch (error) {
      console.error('Network error:', error);
      const errorMessage = 'Network error. Please check your connection and try again.';
      toast.error(errorMessage);
    }
  };

  // Load Google Maps script
  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY) return;

    // Suppress Google Maps IntersectionObserver internal error
    const originalError = console.error;
    console.error = (...args) => {
      if (typeof args[0] === 'string' && args[0].includes('IntersectionObserver')) return;
      originalError.apply(console, args);
    };

    const checkGoogleMaps = () => {
      if ((window as any).google?.maps) {
        setIsGoogleMapsLoaded(true);
        return true;
      }
      return false;
    };

    if (checkGoogleMaps()) return;

    const scriptId = 'google-maps-native-script';
    const existingScript = document.getElementById(scriptId);

    if (existingScript) {
      if (checkGoogleMaps()) return;

      const checkInterval = setInterval(() => {
        if (checkGoogleMaps()) {
          clearInterval(checkInterval);
        }
      }, 500);
      return () => clearInterval(checkInterval);
    }

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places,drawing&v=weekly`;
    script.async = true;
    script.defer = true;

    (window as any).gm_authFailure = () => {
      console.error("Google Maps API Key Authentication Failure - This usually means the API Key is invalid, has no billing, or is restricted incorrectly.");
      toast.error("Google Maps Authentication Failed. Please check your API key.");
      setAuthError(true);
    };

    script.onload = () => setIsGoogleMapsLoaded(true);
    document.head.appendChild(script);

    return () => {
      console.error = originalError;
    };
  }, []);

  // Initialize Map when modal opens
  useEffect(() => {
    if (!isMapOpen || !isGoogleMapsLoaded || !GOOGLE_MAPS_API_KEY) return;

    const initMap = () => {
      if (!mapContainer.current || !window.google) return;

      if (map.current) {
        google.maps.event.clearInstanceListeners(map.current);
      }

      const center = location
        ? { lat: location.lat, lng: location.lng }
        : { lat: 23.2599, lng: 77.4126 };

      // Ensure container still exists and has height
      if (mapContainer.current) {
        const rect = mapContainer.current.getBoundingClientRect();
        if (rect.height === 0) {
          setTimeout(initMap, 200);
          return;
        }
      } else {
        return;
      }

      map.current = new google.maps.Map(mapContainer.current, {
        center,
        zoom: location ? 15 : 5,
        mapTypeControl: true,
        streetViewControl: true,
        fullscreenControl: false,
      });

      geocoder.current = new google.maps.Geocoder();
      autocompleteService.current = new google.maps.places.AutocompleteService();
      placesService.current = new google.maps.places.PlacesService(map.current);

      if (marker.current) {
        marker.current.setMap(null);
      }

      marker.current = new google.maps.Marker({
        position: center,
        map: map.current,
        draggable: true,
        animation: google.maps.Animation.DROP,
      });

      marker.current.addListener('dragend', () => {
        const position = marker.current!.getPosition();
        if (position) {
          setLocation({ lat: position.lat(), lng: position.lng() });
          fetchAddress({ lat: position.lat(), lng: position.lng() });
        }
      });

      map.current.addListener('click', (e: google.maps.MapMouseEvent) => {
        if (!e.latLng) return;
        const lat = e.latLng.lat();
        const lng = e.latLng.lng();
        setLocation({ lat, lng });
        if (marker.current) {
          marker.current.setPosition({ lat, lng });
        }
        fetchAddress({ lat, lng });
      });
    };

    const timeoutId = setTimeout(initMap, 500);

    return () => {
      clearTimeout(timeoutId);
      if (marker.current) {
        marker.current.setMap(null);
      }
    };
  }, [isMapOpen, isGoogleMapsLoaded]);

  const handleSearch = async (query: string) => {
    if (!query || !autocompleteService.current) {
      setSearchResults([]);
      return;
    }

    try {
      autocompleteService.current.getPlacePredictions(
        {
          input: query,
          componentRestrictions: { country: 'IN' },
        },
        (predictions, status) => {
          if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
            setSearchResults(predictions.map(p => ({
              description: p.description,
              place_id: p.place_id,
            })));
          } else {
            setSearchResults([]);
          }
        }
      );
    } catch (error) {
      console.error('Error searching locations:', error);
      setSearchResults([]);
    }
  };

  const fetchAddress = async (location: { lat: number; lng: number }) => {
    if (!geocoder.current) return;

    try {
      geocoder.current.geocode({ location }, (results, status) => {
        if (status === 'OK' && results && results.length > 0) {
          const result = results[0];

          let state = '';
          let city = '';
          let pincode = '';

          result.address_components.forEach((component) => {
            if (component.types.includes('administrative_area_level_1')) {
              state = component.long_name;
            }
            if (component.types.includes('locality')) {
              city = component.long_name;
            } else if (!city && component.types.includes('administrative_area_level_2')) {
              city = component.long_name;
            } else if (!city && component.types.includes('administrative_area_level_3')) {
              city = component.long_name;
            }
            if (component.types.includes('postal_code')) {
              pincode = component.long_name;
            }
          });

          setState(state || '');
          setCity(city || '');
          setPincode(pincode || '');
          setAddress(result.formatted_address || '');
        }
      });
    } catch (error) {
      console.error('Error fetching address:', error);
    }
  };

  const handleSearchResultSelect = (result: GooglePlacesResult) => {
    if (!placesService.current) return;

    placesService.current.getDetails(
      {
        placeId: result.place_id,
        fields: ['geometry', 'address_components', 'formatted_address'],
      },
      (place, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && place?.geometry?.location) {
          const lat = place.geometry.location.lat();
          const lng = place.geometry.location.lng();
          const newLocation = { lat, lng };

          setLocation(newLocation);

          let state = '';
          let city = '';
          let pincode = '';

          place.address_components?.forEach((component) => {
            if (component.types.includes('administrative_area_level_1')) {
              state = component.long_name;
            }
            if (component.types.includes('locality')) {
              city = component.long_name;
            } else if (!city && component.types.includes('administrative_area_level_2')) {
              city = component.long_name;
            } else if (!city && component.types.includes('administrative_area_level_3')) {
              city = component.long_name;
            }
            if (component.types.includes('postal_code')) {
              pincode = component.long_name;
            }
          });

          setState(state || '');
          setCity(city || '');
          setPincode(pincode || '');
          setAddress(place.formatted_address || '');

          if (map.current) {
            map.current.setCenter({ lat, lng });
            map.current.setZoom(15);
          }

          if (marker.current) {
            marker.current.setPosition({ lat, lng });
          }

          setSearchResults([]);
          setSearchQuery('');
        }
      }
    );
  };

  return (
    <div className="min-h-screen w-screen flex items-center justify-center bg-[#422A3C] relative overflow-hidden p-4 md:p-8 select-none">
      {/* Background decorative elements */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        {/* Left side diagonal curved white background shape */}
        <svg className="absolute left-0 top-0 h-full w-full hidden md:block text-gray-50 fill-current" viewBox="0 0 100 100" preserveAspectRatio="none">
          <path d="M 0 0 L 65 0 C 80 30, 75 70, 55 100 L 0 100 Z" />
        </svg>

        {/* Top-left background grey circles */}
        <div className="absolute top-[10%] left-[-3%] w-24 h-24 rounded-full bg-gray-200/50"></div>
        <div className="absolute top-[14%] left-[-1%] w-16 h-16 rounded-full bg-gray-200/30"></div>

        {/* Bottom-left background grey circles */}
        <div className="absolute bottom-[-8%] left-[-8%] w-56 h-56 rounded-full bg-gray-200/50"></div>
        <div className="absolute bottom-[4%] left-[-4%] w-40 h-40 rounded-full bg-gray-200/30"></div>
      </div>

      {/* Back Button */}
      <button
        onClick={() => showRegistrationForm ? setShowRegistrationForm(false) : router.back()}
        className="absolute top-4 left-4 z-20 bg-white/80 hover:bg-white text-gray-800 rounded-full p-2 shadow-md transition-all duration-200"
        aria-label="Go back"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
        </svg>
      </button>

      {/* Main Registration Card */}
      <div className="w-full max-w-[970px] bg-white rounded-[32px] shadow-2xl overflow-hidden flex flex-col md:flex-row relative z-10 min-h-[510px] md:h-[540px]">

        {/* Left Column: Brand & Features */}
        <div className="md:w-[40%] bg-[#422A3C] text-white p-6 md:p-8 pt-10 md:pt-14 pb-8 flex flex-col justify-start gap-12 relative overflow-hidden">
          {/* Decorative interior translucent circles */}
          <div className="absolute -top-10 -right-10 w-44 h-44 rounded-full bg-white/10 pointer-events-none"></div>
          <div className="absolute bottom-[39px] left-[29px] right-10 w-16 h-16 rounded-full bg-white/10 pointer-events-none"></div>
          <div className="absolute bottom-[7px] right-[30px] left-10 w-16 h-16 rounded-full bg-white/10 pointer-events-none"></div>

          {/* User lock icon */}
          <div className="flex flex-col items-center relative z-10">

            <div className="w-[80px] h-[80px] flex items-center justify-center filter drop-shadow-sm">
              <img src="/images/user-profile.png" alt="User profile" className="w-full h-full object-contain" />
            </div>
          </div>

          {/* Feature checklist */}
          <div className="space-y-8 relative z-10">
            <div className="flex items-start gap-2.5">
              <div className="flex-shrink-0 w-5 h-5 rounded-full bg-white flex items-center justify-center mt-0.5 shadow-sm">
                <svg className="w-3.5 h-3.5 text-[#422A3C]" fill="none" stroke="currentColor" strokeWidth="3.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-white text-base leading-tight">Create Your Account</h3>
                <p className="text-white/80 text-xs mt-0.5"> Join Glowvita and start your journey in just a few taps.</p>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <div className="flex-shrink-0 w-5 h-5 rounded-full bg-white flex items-center justify-center mt-0.5 shadow-sm">
                <svg className="w-3.5 h-3.5 text-[#422A3C]" fill="none" stroke="currentColor" strokeWidth="3.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-white text-base leading-tight">Verify Your Number</h3>
                <p className="text-white/80 text-xs mt-0.5">Securely continue with OTP verification for quick and safe access.</p>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <div className="flex-shrink-0 w-5 h-5 rounded-full bg-white flex items-center justify-center mt-0.5 shadow-sm">
                <svg className="w-3.5 h-3.5 text-[#422A3C]" fill="none" stroke="currentColor" strokeWidth="3.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-white text-base leading-tight">Complete Your Profile</h3>
                <p className="text-white/80 text-xs mt-0.5">Add your personal details to create your Glowvita account.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Form */}
        <div className="flex-1 px-6 md:px-16 flex flex-col overflow-hidden h-full max-h-full">
          {/* Header: logo for step 1, title for step 2 */}
          {!showRegistrationForm ? (
            <div className="text-center pt-7 pb-4 flex-shrink-0">
              <div className="flex justify-center mb-2">
                <img
                  src="/images/GlowVita%20Salon%20PNG.png"
                  alt="GlowVita Salon"
                  className="h-14 w-auto object-contain"
                />
              </div>
              <p className="text-gray-600 text-sm mt-1">Register to access booking and appointment management.</p>
            </div>
          ) : (
            <div className="text-center pt-7 pb-3 flex-shrink-0">
              <h2 className="text-gray-900 font-extrabold text-xl">Create Account</h2>
              <p className="text-black-500 text-sm mt-1">Complete your details and verify your email to finish registration</p>
            </div>
          )}

          {/* Form centered in remaining space */}
          <div className="flex-1 flex flex-col justify-center pb-6 overflow-hidden">
            {!showRegistrationForm ? (
              <div className="space-y-5">
                <form onSubmit={handleProceedToForm} className="space-y-6">
                  {/* Mobile Block */}
                  <div className="space-y-4 p-5 rounded-2xl border border-gray-200 bg-white shadow-sm transition-all duration-300 hover:shadow-md">
                    <div className="flex justify-between items-center">
                      <Label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                        Mobile Number <span className="text-red-500">*</span>
                        {!isPhoneOtpSent && !isPhoneVerified && phoneValue.phone.length < 10 && phoneValue.countryCode === '91' && (
                          <span className="text-[10px] font-normal text-gray-400 ml-auto">OTP sends automatically</span>
                        )}
                      </Label>
                      {isPhoneVerified && (
                        <span className="text-green-600 text-xs font-bold flex items-center gap-1 animate-in fade-in zoom-in duration-300">
                          <ShieldCheck className="w-4 h-4" /> Verified
                        </span>
                      )}
                    </div>

                    <PhoneInput
                      value={phoneValue}
                      disabled={isPhoneVerified || isOtpLoading}
                      onChange={(val) => {
                        const changed = val.phone !== phoneValue.phone || val.countryCode !== phoneValue.countryCode;
                        setPhoneValue(val);
                        if (changed) {
                          setIsPhoneVerified(false);
                          setIsPhoneOtpSent(false);
                          setPhoneOtpAttemptedNumber('');
                        }
                      }}
                      placeholder={phoneValue.countryCode === '91' ? 'Enter 10-digit mobile number' : 'Enter phone number'}
                    />

                    {isPhoneOtpSent && !isPhoneVerified && (
                      <div className="space-y-2 pt-2 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-semibold text-gray-700">Enter Security Code</Label>
                          <button
                            type="button"
                            onClick={handleSendPhoneOtp}
                            disabled={isOtpLoading}
                            className="text-[11px] font-bold text-blue-600 hover:underline disabled:text-gray-400"
                          >
                            Resend Code
                          </button>
                        </div>

                        <Input
                          type="text"
                          placeholder="······"
                          maxLength={6}
                          value={phoneOtp}
                          onChange={(e) => setPhoneOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          disabled={isOtpLoading}
                          className="w-full h-11 text-center text-xl tracking-[0.5em] font-medium border border-gray-200 bg-gray-50/30 focus:bg-white rounded-lg transition-all"
                        />
                      </div>
                    )}
                  </div>

                  {/* Main Action Button */}
                  <Button
                    type="submit"
                    disabled={isOtpLoading || (!isPhoneVerified && phoneValue.phone.length < 10 && phoneValue.countryCode === '91')}
                    className="w-full h-11 text-base font-bold bg-[#422A3C] hover:bg-[#34202F] text-white rounded-lg shadow-md transition-all duration-300 flex items-center justify-center gap-2"
                  >
                    {isOtpLoading ? (
                      <RefreshCw className="w-5 h-5 animate-spin" />
                    ) : isPhoneVerified ? (
                      "Continue to Registration"
                    ) : isPhoneOtpSent ? (
                      "Verify OTP"
                    ) : (
                      "Continue"
                    )}
                  </Button>

                  <div className="relative my-4 flex items-center py-0">
                    <div className="flex-grow border-t border-gray-200"></div>
                    <span className="px-3 text-sm font-bold text-gray-400">OR</span>
                    <div className="flex-grow border-t border-gray-200"></div>
                  </div>

                  {/* Google Button */}
                  <button
                    type="button"
                    onClick={() => {/* Add Google OAuth handler */ }}
                    className="w-full h-10 pt-1 text-sm font-bold bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 rounded-lg shadow-sm transition-all duration-200 flex items-center justify-center gap-3"
                  >
                    <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                    <span>Sign up with Google</span>
                  </button>

                  <div className="text-center pt-1 text-sm text-gray-500">
                    Already have an account?{' '}
                    <Link href="/client-login" className="text-[#422A3C] font-bold hover:underline">
                      Sign in
                    </Link>
                  </div>
                </form>
              </div>
            ) : (
              <div className="space-y-4 overflow-y-auto">
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* First Name and Last Name */}
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      id="firstName"
                      placeholder="First Name"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value.replace(/[^a-zA-Z]/g, ''))}
                      className="h-11 px-3.5 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#422A3C]/25 focus:border-[#422A3C] transition-all text-sm font-medium bg-white"
                    />
                    <input
                      id="lastName"
                      placeholder="Last Name"
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value.replace(/[^a-zA-Z]/g, ''))}
                      className="h-11 px-3.5 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#422A3C]/25 focus:border-[#422A3C] transition-all text-sm font-medium bg-white"
                    />
                  </div>

                  {/* Email row — flat, no card */}
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input
                        id="email"
                        type="email"
                        placeholder="Email Address"
                        required
                        value={email}
                        disabled={isEmailVerified || isOtpLoading}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          setIsEmailVerified(false);
                          setIsEmailOtpSent(false);
                        }}
                        className="flex-1 h-11 px-3.5 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#422A3C]/25 focus:border-[#422A3C] transition-all text-sm font-medium bg-white"
                      />
                      {isEmailVerified ? (
                        <span className="h-11 px-3 flex items-center gap-1 text-green-600 text-sm font-bold shrink-0">
                          <ShieldCheck className="w-4 h-4" /> Verified
                        </span>
                      ) : (
                        <Button
                          type="button"
                          onClick={handleSendEmailOtp}
                          disabled={isOtpLoading || !email}
                          className="h-11 px-4 rounded-lg font-bold bg-[#422A3C] hover:bg-[#34202F] text-white transition-all text-sm shrink-0"
                        >
                          {isEmailOtpSent ? 'Resend' : 'Send OTP'}
                        </Button>
                      )}
                    </div>
                    {isEmailOtpSent && !isEmailVerified && (
                      <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="flex justify-between items-center">
                          <Label className="text-xs font-semibold text-gray-700">Enter Verification Code</Label>
                          <button
                            type="button"
                            onClick={handleSendEmailOtp}
                            disabled={isOtpLoading}
                            className="text-[11px] font-semibold text-gray-400 hover:text-gray-600 underline underline-offset-2"
                          >
                            Resend Code
                          </button>
                        </div>
                        <input
                          type="text"
                          placeholder="······"
                          maxLength={6}
                          value={emailOtp}
                          onChange={(e) => setEmailOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          disabled={isOtpLoading}
                          className="w-full h-11 text-center text-xl tracking-[0.5em] font-medium border border-gray-200 bg-gray-50/30 focus:bg-white rounded-lg transition-all"
                        />
                        {isOtpLoading && (
                          <p className="text-[10px] text-center text-gray-500 font-bold">Verifying code...</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Gender and Birthday */}
                  <div className="grid grid-cols-2 gap-3">
                    <select
                      id="gender"
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
                      className="h-11 px-3.5 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#422A3C]/25 focus:border-[#422A3C] transition-all text-sm font-medium bg-white"
                    >
                      <option value="">Select Gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                    <div className="relative">
                      <input
                        id="birthdayDate"
                        type="date"
                        value={birthdayDate}
                        max={new Date().toISOString().split('T')[0]}
                        onChange={(e) => setBirthdayDate(e.target.value)}
                        className="h-11 w-full border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#422A3C]/25 focus:border-[#422A3C] transition-all text-sm font-medium bg-white pr-3 shadow-none px-3.5"
                      />
                    </div>
                  </div>

                  {/* Location and Referral Code */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex gap-1.5">
                      <input
                        id="location"
                        value={confirmedLocation ? `${confirmedLocation.lat.toFixed(4)}, ${confirmedLocation.lng.toFixed(4)}` : ''}
                        placeholder="Select Location"
                        readOnly
                        required
                        className="flex-1 h-11 px-3.5 border border-gray-300 rounded-lg text-gray-900 focus:outline-none text-sm font-medium bg-white min-w-0"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setIsMapOpen(true)}
                        className="h-11 w-11 shrink-0 border border-gray-300 hover:bg-gray-50"
                      >
                        <MapIcon className="h-4 w-4 text-gray-500" />
                      </Button>
                      <input type="hidden" value={state} />
                      <input type="hidden" value={city} />
                      <input type="hidden" value={pincode} />
                    </div>
                    <div className="relative">
                      <Gift className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        id="referralCode"
                        type="text"
                        placeholder="Enter Referral Code"
                        value={referralCode}
                        onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                        className="w-full h-11 pl-10 pr-3.5 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#422A3C]/25 focus:border-[#422A3C] transition-all text-sm font-medium bg-white"
                      />
                    </div>
                  </div>

                  {/* Password Fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="relative">
                      <input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Create Password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        minLength={8}
                        className="w-full h-11 pl-3.5 pr-10 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#422A3C]/25 focus:border-[#422A3C] transition-all text-sm font-medium bg-white"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        id="confirmPassword"
                        type={showConfirmPassword ? 'text' : 'password'}
                        placeholder="Confirm Password"
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        minLength={8}
                        className="w-full h-11 pl-3.5 pr-10 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#422A3C]/25 focus:border-[#422A3C] transition-all text-sm font-medium bg-white"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-11 text-base font-bold bg-[#422A3C] hover:bg-[#34202F] text-white rounded-lg shadow-md transition-all duration-300"
                  >
                    Register
                  </Button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Map Modal */}
      {isMapOpen && (
        <Dialog open={isMapOpen} onOpenChange={setIsMapOpen}>
          <DialogContent className="w-full sm:max-w-5xl h-[90vh] sm:h-[85vh] p-0 gap-0 overflow-hidden flex flex-col border-none shadow-2xl rounded-2xl sm:rounded-3xl">
            <DialogHeader className="p-4 sm:p-6 bg-gradient-to-r from-primary/10 to-transparent border-b">
              <div className="flex items-center justify-between">
                <div>
                  <DialogTitle className="text-xl sm:text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">Find Your Salon</DialogTitle>
                  <DialogDescription className="text-slate-500 text-xs sm:text-sm font-medium">
                    Search for your area and pin your exact location for accurate home service mapping.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="flex-1 flex flex-col relative overflow-hidden min-h-0">
              {/* Floating Search Bar with Glassmorphism */}
              <div className="absolute top-6 left-6 right-6 z-[100] max-w-md">
                <div className="relative group">
                  <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-primary transition-colors">
                    <MapIcon className="h-5 w-5" />
                  </div>
                  <Input
                    placeholder="Where are you located?"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      handleSearch(e.target.value);
                    }}
                    className="w-full h-14 pl-12 pr-6 rounded-2xl border-none shadow-2xl bg-white/90 backdrop-blur-xl text-lg font-medium ring-1 ring-slate-200 focus:ring-2 focus:ring-primary transition-all"
                  />
                  {searchResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-3 bg-white/95 backdrop-blur-2xl border border-slate-200 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.2)] max-h-[350px] overflow-y-auto overflow-x-hidden p-2 z-[110] animate-in slide-in-from-top-2 duration-200">
                      {searchResults.map((result) => (
                        <div
                          key={result.place_id}
                          className="group flex items-start gap-3 p-4 hover:bg-primary/5 cursor-pointer rounded-xl transition-all border-b border-slate-50 last:border-0"
                          onClick={() => {
                            handleSearchResultSelect(result);
                            setSearchQuery('');
                            setSearchResults([]);
                          }}
                        >
                          <div className="mt-0.5 p-2 rounded-full bg-slate-100 group-hover:bg-primary/10 text-slate-500 group-hover:text-primary transition-colors">
                            <MapPin className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-slate-800 group-hover:text-primary truncate transition-colors font-headline">
                              {result.description}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Map Container */}
              <div className="flex-1 relative bg-slate-100 min-h-0">
                <div
                  ref={mapContainer}
                  className="w-full h-full"
                />

                {authError && (
                  <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-6 z-[200]">
                    <div className="bg-white rounded-3xl p-8 shadow-2xl max-w-md text-center border border-red-100">
                      <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500">
                        <MapPin className="h-8 w-8" />
                      </div>
                      <h3 className="text-xl font-bold text-slate-900 mb-2">Map Connection Lost</h3>
                      <p className="text-slate-500 text-sm mb-6">
                        We're having trouble connecting to Google Maps. Please check your connection or reload the page.
                      </p>
                      <Button
                        onClick={() => window.location.reload()}
                        className="w-full rounded-xl bg-red-600 hover:bg-red-700 h-12 text-lg font-headline"
                      >
                        Reload Page
                      </Button>
                    </div>
                  </div>
                )}

                {!isGoogleMapsLoaded && !authError && (
                  <div className="absolute inset-0 bg-slate-100 flex items-center justify-center">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-3"></div>
                      <p className="text-slate-600 font-medium">Loading map...</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Action Area */}
              <div className="p-4 sm:p-6 bg-slate-50 border-t flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
                <div className="flex-1 min-w-0">
                  {location && (
                    <div className="flex items-center gap-2 text-slate-600">
                      <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                        <MapPin className="h-4 w-4" />
                      </div>
                      <p className="text-sm font-medium truncate">
                        {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                      </p>
                    </div>
                  )}
                </div>
                <div className="flex gap-3 w-full sm:w-auto">
                  <Button variant="outline" className="flex-1 sm:flex-none rounded-xl" onClick={() => setIsMapOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    className="flex-1 sm:flex-none rounded-xl px-8"
                    onClick={() => {
                      if (!city || !pincode) {
                        toast.error("We couldn't detect city or pincode for this location. Please drag the pin or search again.");
                        return;
                      }
                      setConfirmedLocation(location);
                      setIsMapOpen(false);
                    }}
                    disabled={!location}
                  >
                    Confirm Location
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

export default function ClientRegisterPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading registration form...</p>
        </div>
      </div>
    }>
      <ClientRegisterForm />
    </Suspense>
  );
}
