import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';

interface GsapRevealProps {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  y?: number;
  stagger?: number;
  className?: string;
  id?: string;
}

export const GsapReveal: React.FC<GsapRevealProps> = ({
  children,
  delay = 0,
  duration = 0.9,
  y = 30,
  stagger = 0,
  className = '',
  id,
}) => {
  const elRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;

    const ctx = gsap.context(() => {
      if (stagger > 0 && el.children.length > 1) {
        gsap.fromTo(
          el.children,
          {
            opacity: 0,
            y,
            filter: 'blur(6px)',
          },
          {
            opacity: 1,
            y: 0,
            filter: 'blur(0px)',
            duration,
            delay,
            stagger,
            ease: 'power3.out',
          }
        );
      } else {
        gsap.fromTo(
          el,
          {
            opacity: 0,
            y,
            filter: 'blur(8px)',
          },
          {
            opacity: 1,
            y: 0,
            filter: 'blur(0px)',
            duration,
            delay,
            ease: 'power3.out',
          }
        );
      }
    }, elRef);

    return () => ctx.revert();
  }, [delay, duration, y, stagger]);

  return (
    <div id={id} ref={elRef} className={className}>
      {children}
    </div>
  );
};
