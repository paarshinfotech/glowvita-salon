import React, { useState, useEffect, useRef } from 'react';
import { Star } from 'lucide-react';

interface Testimonial {
  id: string;
  quote: string;
  name: string;
  location: string;
  rating: number;
}

const Testimonials = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [position, setPosition] = useState(0);

  const testimonials: Testimonial[] = [
    {
      id: '1',
      quote: 'Absolutely love the curated selection! Every product I\'ve tried has exceeded my expectations. Fast shipping and great prices too.',
      name: 'Manish Sonawane',
      location: 'Navi Mumbai, Maharashtra',
      rating: 5,
    },
    {
      id: '2',
      quote: 'The customer support is fantastic! They helped me with a return quickly and professionally. Highly recommend this marketplace.',
      name: 'Shubham Vanarse',
      location: 'Nashik, Maharashtra',
      rating: 5,
    },
    {
      id: '3',
      quote: 'I love the eco-friendly packaging and the variety of brands. The site is easy to use and the deals are unbeatable!',
      name: 'Siddhi Shinde',
      location: 'Nashik, Maharashtra',
      rating: 5,
    },
  ];

  const totalWidth = testimonials.length * 384; // 384px per testimonial

  useEffect(() => {
    if (isHovered || testimonials.length === 0) return;

    const interval = setInterval(() => {
      setPosition(prev => {
        // Move left continuously
        let newPosition = prev - 1;
        // When we've moved past the first set of testimonials, reset
        if (newPosition <= -totalWidth) {
          return 0;
        }
        return newPosition;
      });
    }, 50); // Adjust speed as needed

    return () => clearInterval(interval);
  }, [isHovered, totalWidth, testimonials.length]);

  // Duplicate testimonials for seamless loop
  const allTestimonials = [...testimonials, ...testimonials];

  return (
    <section className="pt-0 pb-12 container mx-auto px-4 sm:px-6 lg:px-8 bg-background">
      {/* Section Header */}
      <div className="mb-12">
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins:wght@700&display=swap" />
        <div style={{ display: 'inline-block', maxWidth: '100%' }}>
          <h2
            style={{
              fontFamily: "'Poppins', sans-serif",
              fontWeight: 700,
              fontSize: '28px',
              lineHeight: '38px',
              color: '#000000',
              maxWidth: '390px',
              height: '38px',
              margin: 0,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            What Our Customers Say
          </h2>
          <div
            style={{
              width: '100%',
              maxWidth: '390px',
              height: '3px',
              marginTop: '6px',
              background: 'linear-gradient(90deg, #422A3C 0%, #FFFFFF 100%)',
              border: 'none',
            }}
          />
        </div>
      </div>

      {/* Scrolling Testimonials Container */}
      <div
        ref={containerRef}
        className="overflow-hidden w-full py-4 relative"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Left fade overlay */}
        <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none"></div>
        {/* Right fade overlay */}
        <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none"></div>

        <div
          className="flex"
          style={{
            transform: `translateX(${position}px)`
          }}
        >
          {allTestimonials.map((testimonial, i) => (
            <div key={`${testimonial.id}-${i}`} className="flex-shrink-0 w-[384px] px-3">
              <div
                className="bg-card border border-border rounded-3xl p-6 shadow-sm hover:shadow-md transition-all duration-300 group hover:border-primary/50 flex flex-col h-full"
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className="bg-primary/10 text-primary p-3 rounded-2xl flex-shrink-0 group-hover:scale-110 group-hover:bg-primary/20 transition-all duration-300">
                    <Star className="w-6 h-6" strokeWidth={2.5} fill="currentColor" />
                  </div>
                  <h3 className="font-bold text-card-foreground text-lg items-center leading-tight">
                    {testimonial.name}
                  </h3>
                </div>
                <div className="flex mb-3">
                  {[...Array(5)].map((_, starIndex) => (
                    <Star
                      key={starIndex}
                      className={`w-4 h-4 ${starIndex < testimonial.rating ? 'text-primary fill-primary' : 'text-muted-foreground fill-muted-foreground'}`}
                      strokeWidth={1.5}
                    />
                  ))}
                </div>
                <p className="text-muted-foreground text-sm leading-relaxed flex-grow">
                  "{testimonial.quote}"
                </p>
                <p className="text-xs text-muted-foreground mt-4 pt-3 border-t border-border">
                  {testimonial.location}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Testimonials;