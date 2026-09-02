import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
}

/**
 * GymTech brand mark.
 *
 * A single, confident shape: a rounded square with a serif "G" carved out
 * in negative space. The mark holds the line in every density — it scales
 * from a 24px favicon to a 56px marketing placement without losing its
 * identity. No gradients, no shadows, just iron-orange on the surface.
 */
export const Logo: React.FC<LogoProps> = ({
  size = 'md',
  showText = true,
  className = '',
}) => {
  const iconSizes = {
    sm: 'h-7 w-7',
    md: 'h-9 w-9',
    lg: 'h-12 w-12',
    xl: 'h-16 w-16',
  };

  const textSizes = {
    sm: 'text-[15px]',
    md: 'text-[17px]',
    lg: 'text-xl',
    xl: 'text-2xl',
  };

  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      <span
        className={`${iconSizes[size]} relative inline-flex items-center justify-center rounded-lg bg-iron text-iron-ink overflow-hidden shrink-0`}
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 32 32"
          className="w-[60%] h-[60%]"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M16 4.5c-6.351 0-11.5 5.149-11.5 11.5S9.649 27.5 16 27.5c4.97 0 9.205-3.151 10.808-7.55H16V15.6h15.5C31.825 16.52 32 17.49 32 18.5 32 26.508 24.836 33 16 33 7.163 33 0 25.837 0 17S7.163 1 16 1c5.682 0 10.66 3.018 13.476 7.527l-5.214 3.78C22.43 9.026 19.477 6.5 16 6.5c-5.799 0-10.5 4.701-10.5 10.5S10.201 27.5 16 27.5c4.32 0 8.026-2.61 9.64-6.33H16v-4.4h15.5z"
            fill="currentColor"
            fillRule="evenodd"
          />
        </svg>
      </span>

      {showText && (
        <span
          className={`font-display font-semibold tracking-tight text-(--ink) ${textSizes[size]} leading-none`}
        >
          GymTech
        </span>
      )}
    </div>
  );
};
