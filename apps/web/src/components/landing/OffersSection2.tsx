import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useGetPublicAllOffersQuery } from '@repo/store/services/api';
import { useSelector } from 'react-redux';
import Link from 'next/link';
import { useSalonFilter } from './SalonFilterContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@repo/ui/dialog';
import { Button } from '@repo/ui/button';
import { Sparkles, Copy, Check, Search, ArrowRight, Calendar } from 'lucide-react';
import { toast } from 'sonner';

interface SimplifiedOffer {
  code: string;
  title: string; // <-- NEW: short description shown on the circle (e.g. "Free Skin Prep with any Makeup Service")
  discount: string;
  image: string;
  validTill: string;
  salonName: string;
  services: string[];
}

const PortalTooltip = ({
  left,
  top,
  services,
}: {
  left: number;
  top: number;
  services: string[];
}) => {
  if (typeof document === 'undefined') return null;

  const previewServices = services.slice(0, 3);
  const remainingCount = services.length - 3;

  return createPortal(
    <div
      style={{
        position: 'absolute',
        left: `${left}px`,
        top: `${top}px`,
        // Left edge anchored to circle's left edge; only move up 100%
        transform: 'translateY(-100%)',
        backgroundColor: '#EBF3FD',
        borderColor: '#c8dff7',
        zIndex: 9999,
      }}
      className="border rounded-xl shadow-xl p-3 w-fit max-w-[260px] pointer-events-none"
    >
      {/* Arrow at fixed offset pointing down on the left side of the tooltip */}
      <div
        className="absolute -bottom-2 left-6 -translate-x-1/2 border-8 border-transparent"
        style={{ borderTopColor: '#EBF3FD' }}
      />
      <div
        className="absolute -bottom-[10px] left-6 -translate-x-1/2 border-[9px] border-transparent -z-10"
        style={{ borderTopColor: '#c8dff7' }}
      />

      {previewServices.length > 0 ? (
        <div className="space-y-1">
          {previewServices.map((service, sIdx) => (
            <div key={sIdx} className="flex items-center gap-1.5 text-xs sm:text-sm text-gray-800 whitespace-nowrap">
              <span className="text-[#422A3C] font-bold leading-none">•</span>
              <span className="font-medium truncate max-w-[210px]">{service}</span>
            </div>
          ))}
          {remainingCount > 0 && (
            <div className="text-[11px] font-semibold text-[#422A3C] pt-0.5 pl-3">
              ... +{remainingCount} more
            </div>
          )}
        </div>
      ) : (
        <p className="text-xs text-gray-500 italic">Applicable on all services</p>
      )}
    </div>,
    document.body
  );
};

const OfferCircleItem = ({
  offer,
  salonsUrl,
  onViewMore,
}: {
  offer: SimplifiedOffer;
  salonsUrl: string;
  onViewMore: (offer: SimplifiedOffer, salonsUrl: string) => void;
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [tooltipCoords, setTooltipCoords] = useState<{ left: number; top: number; } | null>(null);
  const elementRef = useRef<HTMLDivElement>(null);
  const validTillRef = useRef<HTMLDivElement>(null);
  const discountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isHovered) {
      const circleEl = elementRef.current;
      const pillEl = validTillRef.current ?? discountRef.current ?? elementRef.current;
      if (circleEl && pillEl) {
        const circleRect = circleEl.getBoundingClientRect();
        const pillRect = pillEl.getBoundingClientRect();
        const scrollX = window.scrollX ?? window.pageXOffset ?? 0;
        const scrollY = window.scrollY ?? window.pageYOffset ?? 0;

        // Tooltip left edge = circle's left edge + small rightward nudge
        const left = circleRect.left + scrollX + 100;
        // Tooltip bottom touches the top of the validity pill
        const top = pillRect.top + scrollY;

        setTooltipCoords({ left, top });
      }
    } else {
      setTooltipCoords(null);
    }
  }, [isHovered]);

  const services = offer.services || [];
  let displayText = offer.title;

  if (services.length > 0) {
    if (services.length <= 2) {
      displayText = services.join(' + ');
    } else {
      displayText = `${services.slice(0, 2).join(' + ')} + ...`;
    }
  }

  return (
    <div
      ref={elementRef}
      className="relative flex flex-col items-center flex-shrink-0 group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Link
        href={salonsUrl}
        className="flex flex-col items-center"
      >
        {/* Circle with image + overlay text */}
        <div className="relative w-24 h-24 sm:w-28 sm:h-28 lg:w-32 lg:h-32 rounded-full overflow-hidden shadow-lg">
          <img
            src={offer.image}
            alt={offer.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
          />
          <div className="absolute inset-0 bg-black/45"></div>
          <div className="absolute inset-0 flex items-center justify-center px-2.5 text-center">
            <span className="text-white text-[10px] sm:text-[11px] lg:text-xs font-bold leading-tight drop-shadow-md">
              {displayText}
            </span>
          </div>
        </div>

        {/* Discount pill - overlaps circle bottom */}
        <div
          ref={discountRef}
          className="relative z-10 -mt-3 bg-green-600 text-white text-[10px] sm:text-[12px] font-bold px-3 py-1 rounded-full shadow-md whitespace-nowrap"
        >
          {offer.discount}
        </div>

        {/* Valid till pill */}
        {offer.validTill && (
          <div
            ref={validTillRef}
            className="relative z-10 -mt-1 bg-red-900 text-white text-[9px] sm:text-[13px] font-semibold px-3 py-1 rounded-full shadow-md whitespace-nowrap"
          >
            Valid till : {offer.validTill}
          </div>
        )}
      </Link>

      {/* View More pill button when there are more than 3 services */}
      {services.length > 3 && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onViewMore(offer, salonsUrl);
          }}
          className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-[#422A3C] hover:text-[#252B42] bg-[#EBF3FD] hover:bg-[#dceafb] border border-[#c8dff7] px-2.5 py-0.5 rounded-full shadow-sm transition-all cursor-pointer"
        >
          +{services.length - 3} more
        </button>
      )}

      {/* Tooltip Portal: left edge = circle left, arrow points at the pill center */}
      {tooltipCoords && (
        <PortalTooltip
          left={tooltipCoords.left}
          top={tooltipCoords.top}
          services={services}
        />
      )}
    </div>
  );
};

const OffersSection2 = () => {
  const { selectedRegionId, userLat, userLng, locationLabel } = useSalonFilter();
  const user = useSelector((state: any) => state.userAuth?.user);
  const profileRegionId = user?.regionId || null;
  const activeRegionId = selectedRegionId || profileRegionId;

  const [selectedOfferModal, setSelectedOfferModal] = useState<{
    offer: SimplifiedOffer;
    salonsUrl: string;
  } | null>(null);
  const [offerSearchTerm, setOfferSearchTerm] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const handleCopyCode = (code: string) => {
    if (!code) return;
    navigator.clipboard?.writeText(code);
    setCopiedCode(code);
    toast.success(`Coupon code "${code}" copied!`);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const { data: offersData, isLoading, error } = useGetPublicAllOffersQuery(
    activeRegionId ? { regionId: activeRegionId } : {}
  );

  useEffect(() => {
    if (offersData) console.log('Fetched offers:', offersData);
    if (error) console.error('Error fetching offers:', error);
  }, [offersData, error]);

  const offers: SimplifiedOffer[] = offersData?.data && !isLoading && !error
    ? offersData.data
      .filter((offer: any) => offer.status === 'Active')
      .map((offer: any) => ({
        code: offer.code,
        // Adjust this to whatever field your API actually returns for the description text
        title: offer.title || offer.description || offer.name || 'Special Offer',
        discount: `${offer.type === 'percentage' ? offer.value + '% OFF' : '₹' + offer.value + ' OFF'}`,
        image: offer.offerImage || '/images/Offer Placeholder.png',
        validTill: offer.expires
          ? new Date(offer.expires).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
          : '',
        salonName: 'Valid @ All Salons',
        services: offer.applicableSpecialties || [],
      }))
    : [];

  useEffect(() => {
    console.log('Final offers displayed:', offers);
  }, [offers]);

  const displayOffersList = React.useMemo(() => {
    if (offers.length === 0) return [];
    const minItems = 12;
    const repeatsNeeded = Math.ceil(minItems / offers.length);
    const unit = [];
    for (let i = 0; i < repeatsNeeded; i++) unit.push(...offers);
    return [...unit, ...unit];
  }, [offers]);

  const OfferSkeleton = () => (
    <div className="flex flex-col items-center flex-shrink-0 animate-pulse">
      <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-gray-200"></div>
      <div className="-mt-3 h-5 w-16 rounded-full bg-gray-300"></div>
      <div className="-mt-1 h-5 w-20 rounded-full bg-gray-300"></div>
    </div>
  );

  const isLoopingRequired = offers.length > 4;
  const marqueeItems = isLoopingRequired ? displayOffersList : offers;

  return (
    <section className="pt-5 pb-0 container mx-auto px-4 sm:px-6 lg:px-8 bg-background">
      <div className="mb-5 flex items-center justify-between">
        <h2
          className="relative inline-block text-2xl md:text-3xl font-serif font-bold pb-3"
          style={{ color: "#252B42" }}
        >
          Special Offers
          <span
            className="absolute left-0 bottom-0 h-[3px] w-full rounded-full"
            style={{
              background:
                "linear-gradient(to right, #252B42 0%, #252B42 40%, transparent 100% )",
            }}
          />
        </h2>
      </div>

      <div className="relative">

        {isLoading ? (
          <div className="flex gap-6 sm:gap-8 lg:gap-10 justify-start pt-1 pb-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <OfferSkeleton key={index} />
            ))}
          </div>
        ) : error ? (
          <div className="text-left py-8">
            <p className="text-gray-500 text-sm sm:text-base">Unable to load offers at the moment.</p>
          </div>
        ) : offers.length === 0 ? (
          <div className="text-left py-8">
            <p className="text-gray-500 text-sm sm:text-base">No active offers available right now.</p>
          </div>
        ) : (
          <div className="flex overflow-hidden w-full">
            <div className={`flex items-start ${isLoopingRequired ? 'animate-marquee hover:[animation-play-state:paused] w-max' : 'w-full justify-start'} pt-1 pb-3 pr-4 sm:pr-6 gap-6 sm:gap-8 lg:gap-10`}>
              {marqueeItems.map((offer, index) => {
                const params = new URLSearchParams();
                params.append("offerCode", offer.code);
                if (userLat) params.append("lat", userLat.toString());
                if (userLng) params.append("lng", userLng.toString());
                if (locationLabel) params.append("locationLabel", locationLabel);
                if (selectedRegionId) params.append("regionId", selectedRegionId);

                const salonsUrl = `/salons?${params.toString()}`;

                return (
                  <OfferCircleItem
                    key={index}
                    offer={offer}
                    salonsUrl={salonsUrl}
                    onViewMore={(selectedOffer, url) => {
                      setOfferSearchTerm('');
                      setSelectedOfferModal({ offer: selectedOffer, salonsUrl: url });
                    }}
                  />
                );
              })}
            </div>
          </div>
        )}

      </div>

      {/* Attractive Offer Details Modal */}
      <Dialog
        open={!!selectedOfferModal}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedOfferModal(null);
            setOfferSearchTerm('');
          }
        }}
      >
        <DialogContent className="sm:max-w-xl p-0 overflow-hidden border-0 shadow-2xl rounded-2xl">
          {selectedOfferModal && (() => {
            const { offer, salonsUrl } = selectedOfferModal;
            const allServices = offer.services || [];
            const filteredServices = offerSearchTerm.trim()
              ? allServices.filter((s) =>
                  s.toLowerCase().includes(offerSearchTerm.toLowerCase())
                )
              : allServices;

            return (
              <div className="flex flex-col max-h-[85vh]">
                {/* Hero Header */}
                <div className="relative bg-gradient-to-br from-[#252B42] via-[#342a45] to-[#422A3C] text-white p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-16 h-16 rounded-xl overflow-hidden border-2 border-white/30 shadow-md flex-shrink-0 bg-white">
                      <img
                        src={offer.image}
                        alt={offer.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center flex-wrap gap-2 mb-1.5">
                        <span className="inline-flex items-center gap-1 bg-white/15 backdrop-blur-sm text-white text-[11px] font-semibold px-2.5 py-0.5 rounded-full">
                          <Sparkles className="h-3 w-3" />
                          Special Offer
                        </span>
                        {offer.validTill && (
                          <span className="inline-flex items-center gap-1 bg-red-900/90 text-white text-[11px] font-semibold px-2.5 py-0.5 rounded-full">
                            <Calendar className="h-3 w-3" />
                            Valid till {offer.validTill}
                          </span>
                        )}
                      </div>
                      <DialogHeader className="text-left space-y-1">
                        <DialogTitle className="text-xl font-bold text-white leading-tight">
                          {offer.title}
                        </DialogTitle>
                        <DialogDescription className="text-white/80 text-xs sm:text-sm">
                          {offer.salonName}
                        </DialogDescription>
                      </DialogHeader>
                    </div>
                    <div className="bg-green-600 text-white px-3 py-1.5 rounded-xl text-sm sm:text-base font-extrabold shadow-md flex-shrink-0">
                      {offer.discount}
                    </div>
                  </div>

                  {/* Copyable Promo Code Strip */}
                  {offer.code && (
                    <div className="mt-4 flex items-center justify-between gap-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl px-4 py-2.5">
                      <div>
                        <span className="text-[10px] uppercase tracking-wider text-white/70 font-semibold block">
                          Promo Code
                        </span>
                        <span className="font-mono font-bold text-base tracking-wider text-white">
                          {offer.code}
                        </span>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => handleCopyCode(offer.code)}
                        className="gap-1.5 font-semibold shadow-sm"
                      >
                        {copiedCode === offer.code ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-green-600" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" />
                            Copy Code
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>

                {/* All Applicable Services */}
                <div className="p-6 bg-background flex-1 overflow-hidden flex flex-col gap-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <h5 className="font-bold text-sm text-[#252B42]">
                        Applicable Services
                      </h5>
                      <span className="bg-[#EBF3FD] text-[#422A3C] border border-[#c8dff7] text-xs font-bold px-2 py-0.5 rounded-full">
                        {allServices.length}
                      </span>
                    </div>
                    {allServices.length > 8 && (
                      <div className="relative w-full sm:w-52">
                        <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={offerSearchTerm}
                          onChange={(e) => setOfferSearchTerm(e.target.value)}
                          placeholder="Search services..."
                          className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-input bg-muted/40 focus:bg-background focus:outline-none focus:ring-2 focus:ring-[#422A3C]/30 transition-all"
                        />
                      </div>
                    )}
                  </div>

                  <div className="overflow-y-auto pr-1 max-h-[280px]">
                    {filteredServices.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {filteredServices.map((service, idx) => (
                          <span
                            key={service + idx}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-[#EBF3FD] text-[#252B42] border border-[#c8dff7]"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-[#422A3C] flex-shrink-0" />
                            {service}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-6">
                        No matching services found for &ldquo;{offerSearchTerm}&rdquo;.
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setSelectedOfferModal(null);
                        setOfferSearchTerm('');
                      }}
                    >
                      Close
                    </Button>
                    <Link href={salonsUrl}>
                      <Button className="bg-[#422A3C] hover:bg-[#252B42] text-white gap-1.5">
                        Browse Salons
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default OffersSection2;