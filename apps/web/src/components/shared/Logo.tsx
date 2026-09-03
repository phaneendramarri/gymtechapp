import React from 'react';

export interface LogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
  iconClassName?: string;
  textClassName?: string;
  variant?: 'default' | 'monochrome';
}

/**
 * GymTech brand logo mark vector glyph from public/favicon.svg.
 */
export const LogoIcon: React.FC<{
  className?: string;
  variant?: 'default' | 'monochrome';
}> = ({ className = 'h-7 w-auto aspect-[1255/650]', variant = 'default' }) => {
  return (
    <svg
      viewBox="0 0 1255 650"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <g transform="translate(-130 -135)">
        {/* Dark / Ink base glyphs */}
        <g
          className={
            variant === 'monochrome'
              ? 'fill-current'
              : 'fill-[var(--ink,#161616)] dark:fill-[var(--ink,#FAFAF9)]'
          }
          fillRule="evenodd"
        >
          <path d="M149 467 142 474 139 491 141 535 143 540 150 545H174L171 497 175 467Z" />
          <path d="M213 413 202 421 195 436 189 458 184 502 187 549 196 583 206 598 211 600H247L237 546 236 485 240 450 249 413Z" />
          <path d="M284 384 273 391 265 406 253 450 249 485 251 557 259 597 264 612 272 626 280 631H320L331 622 339 606 346 582 351 546 344 551 334 584 328 591H321L314 578 307 535 309 466 317 431 324 422 328 421 333 425 339 437 345 464 351 468 348 434 340 403 336 394 329 386 325 384Z" />
          <path d="M934 167 645 168 619 172 588 181 562 192 539 205 509 227 483 252 453 290 429 330 416 357 401 399 392 443 390 481 388 483H347L343 475 336 470 330 472 326 477 321 498 321 521 326 540 331 545H338L343 541 347 533H393L399 557 415 599 432 630 456 663 477 685 504 707 531 724 561 738 591 748 620 754H677L707 752 738 744 766 733 790 720 829 691V497H572L637 572H740V644L738 646 709 657 677 664 643 665 616 661 586 651 550 629 527 607 503 573 486 533 479 495V459L487 417 495 394 508 367 530 334 560 303 588 283 627 266 664 259H866Z" />
        </g>
        {/* Iron accent glyphs */}
        <g
          className={
            variant === 'monochrome'
              ? 'fill-current opacity-70'
              : 'fill-[var(--iron,#D9480F)]'
          }
          fillRule="evenodd"
        >
          <path d="M1186 480 1180 471 1172 470 1167 474 1162 483H1096L1057 532H1162L1167 544 1172 548H1178L1186 538 1190 518V501Z" />
          <path d="M1334 467 1337 490V525L1334 545H1360L1367 538 1370 525 1371 500 1368 476 1360 467Z" />
          <path d="M1261 413 1270 454 1274 500 1271 555 1261 600H1300L1307 595 1312 586 1323 545 1325 491 1320 454 1313 431 1304 416 1298 413Z" />
          <path d="M1188 384 1178 391 1168 410 1160 442 1158 470 1166 464 1170 442 1176 428 1180 423 1186 422 1192 429 1196 440 1203 483 1202 545 1197 574 1190 592 1186 596H1181L1177 592 1170 576 1165 552 1157 546 1159 567 1168 605 1174 618 1182 628 1191 632H1227L1239 623 1245 612 1257 569 1261 535V481L1258 454 1248 412 1236 389 1228 384Z" />
          <path d="M586 456H867V781L960 674V457H1083L1160 357H670L657 363 648 372Z" />
          <path d="M923 245 927 251H1077L1081 247 1080 242 1077 240H927Z" />
          <path d="M1216 249 1213 241 1207 235 1194 232 1185 236 1178 246H1129L1097 279H896L893 281 892 286 896 290H1102L1134 257H1178L1187 269 1203 271 1213 263ZM1196 242 1202 244 1206 250 1204 258 1200 261 1192 260 1188 254 1189 247Z" />
          <path d="M956 204 959 211H1230L1259 241H1306L1309 247 1319 255 1333 254 1341 247 1344 239 1341 225 1335 219 1328 216 1316 218 1306 230H1264L1234 200H960ZM1325 226 1332 230 1334 238 1329 244 1322 245 1318 242 1316 234 1320 228Z" />
          <path d="M1271 167V157L1268 150 1261 143 1250 141 1240 146 1234 156H996L992 161 996 167H1234L1242 178 1249 181H1257L1263 178ZM1251 152 1258 154 1261 158 1260 167 1253 171 1244 165 1245 156Z" />
        </g>
      </g>
    </svg>
  );
};

export const LogoMark = LogoIcon;

/**
 * GymTech brand logo with icon and optional text mark.
 */
export const Logo: React.FC<LogoProps> = ({
  size = 'md',
  showText = true,
  className = '',
  iconClassName = '',
  textClassName = '',
  variant = 'default',
}) => {
  const iconSizes = {
    xs: 'h-5 w-auto aspect-[1255/650]',
    sm: 'h-6 w-auto aspect-[1255/650]',
    md: 'h-7 w-auto aspect-[1255/650]',
    lg: 'h-9 w-auto aspect-[1255/650]',
    xl: 'h-12 w-auto aspect-[1255/650]',
  };

  const textSizes = {
    xs: 'text-xs',
    sm: 'text-sm font-semibold',
    md: 'text-base font-bold',
    lg: 'text-xl font-bold',
    xl: 'text-2xl font-bold',
  };

  return (
    <div className={`inline-flex items-center gap-2.5 select-none shrink-0 ${className}`}>
      <LogoIcon
        className={`${iconSizes[size]} shrink-0 ${iconClassName}`}
        variant={variant}
      />

      {showText && (
        <span
          className={`font-display tracking-tight text-[var(--ink,#0A0A0A)] dark:text-[var(--ink,#FAFAF9)] leading-none ${textSizes[size]} ${textClassName}`}
        >
          GymTech
        </span>
      )}
    </div>
  );
};

