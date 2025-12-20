import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Polygon, Rect, G, Defs, LinearGradient, Stop } from 'react-native-svg';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';

interface IconProps {
  size?: number;
  color?: string;
}

// Currency Icons
export function CoinIcon({ size = 24, color = colors.coins }: IconProps): React.ReactElement {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="10" fill={color} />
      <Circle cx="12" cy="12" r="7" fill={`${color}dd`} stroke={`${color}88`} strokeWidth="1" />
      <Path
        d="M12 6v12M9 9h6M9 15h6"
        stroke="#1a1a1a"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function StarIcon({ size = 24, color = colors.stars }: IconProps): React.ReactElement {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
        fill={color}
        stroke={`${color}88`}
        strokeWidth="1"
      />
    </Svg>
  );
}

export function GemIcon({ size = 24, color = colors.gems }: IconProps): React.ReactElement {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2L2 9l10 13 10-13L12 2z"
        fill={color}
        stroke={`${color}88`}
        strokeWidth="1"
      />
      <Path
        d="M2 9h20M12 2v20M7 9l5 13M17 9l-5 13"
        stroke={`${color}44`}
        strokeWidth="0.5"
      />
    </Svg>
  );
}

// Navigation Icons
export function HomeIcon({ size = 24, color = colors.textPrimary }: IconProps): React.ReactElement {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function CalendarIcon({ size = 24, color = colors.textPrimary }: IconProps): React.ReactElement {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="3" y="4" width="18" height="18" rx="2" stroke={color} strokeWidth="2" />
      <Path d="M16 2v4M8 2v4M3 10h18" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Circle cx="12" cy="16" r="2" fill={color} />
    </Svg>
  );
}

export function TargetIcon({ size = 24, color = colors.textPrimary }: IconProps): React.ReactElement {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2" />
      <Circle cx="12" cy="12" r="6" stroke={color} strokeWidth="2" />
      <Circle cx="12" cy="12" r="2" fill={color} />
    </Svg>
  );
}

export function TrophyIcon({ size = 24, color = colors.textPrimary }: IconProps): React.ReactElement {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M8 21h8m-4-4v4m-5-8c-1.5 0-3-1-3-3V6h16v4c0 2-1.5 3-3 3"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M7 6V5a2 2 0 012-2h6a2 2 0 012 2v1"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <Path
        d="M12 13c2 0 4-1.5 4-4V6H8v3c0 2.5 2 4 4 4z"
        fill={color}
        fillOpacity="0.2"
        stroke={color}
        strokeWidth="2"
      />
    </Svg>
  );
}

export function UserIcon({ size = 24, color = colors.textPrimary }: IconProps): React.ReactElement {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="8" r="4" stroke={color} strokeWidth="2" />
      <Path
        d="M20 21c0-4-3.5-7-8-7s-8 3-8 7"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </Svg>
  );
}

// Action Icons
export function GiftIcon({ size = 24, color = colors.primary }: IconProps): React.ReactElement {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="3" y="8" width="18" height="4" rx="1" fill={color} fillOpacity="0.2" stroke={color} strokeWidth="2" />
      <Rect x="5" y="12" width="14" height="9" rx="1" stroke={color} strokeWidth="2" />
      <Path d="M12 8v13" stroke={color} strokeWidth="2" />
      <Path
        d="M12 8c-2-2-4-3-4-1s2 3 4 3 4-1 4-3-2-1-4 1z"
        fill={color}
        fillOpacity="0.3"
        stroke={color}
        strokeWidth="1.5"
      />
    </Svg>
  );
}

export function FireIcon({ size = 24, color = '#FF6B6B' }: IconProps): React.ReactElement {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 22c4.5 0 7-3.5 7-7.5 0-5-4-8.5-7-11.5-3 3-7 6.5-7 11.5 0 4 2.5 7.5 7 7.5z"
        fill={color}
        fillOpacity="0.2"
        stroke={color}
        strokeWidth="2"
      />
      <Path
        d="M12 22c2 0 3.5-1.5 3.5-4 0-2.5-2-4-3.5-5.5-1.5 1.5-3.5 3-3.5 5.5 0 2.5 1.5 4 3.5 4z"
        fill={color}
      />
    </Svg>
  );
}

export function AlertIcon({ size = 24, color = colors.error }: IconProps): React.ReactElement {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2" />
      <Path d="M12 8v4m0 4h.01" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

export function CheckIcon({ size = 24, color = colors.success }: IconProps): React.ReactElement {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="10" fill={color} fillOpacity="0.2" stroke={color} strokeWidth="2" />
      <Path d="M8 12l2.5 2.5L16 9" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function CloseIcon({ size = 24, color = colors.textMuted }: IconProps): React.ReactElement {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M6 6l12 12M6 18L18 6" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

export function ChevronRightIcon({ size = 24, color = colors.textMuted }: IconProps): React.ReactElement {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M9 6l6 6-6 6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function SettingsIcon({ size = 24, color = colors.textPrimary }: IconProps): React.ReactElement {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="3" stroke={color} strokeWidth="2" />
      <Path
        d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function HelpIcon({ size = 24, color = colors.textPrimary }: IconProps): React.ReactElement {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2" />
      <Path
        d="M9 9c0-1.5 1.5-3 3-3s3 1.5 3 3c0 2-3 2-3 4"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <Circle cx="12" cy="17" r="1" fill={color} />
    </Svg>
  );
}

export function ShopIcon({ size = 24, color = colors.textPrimary }: IconProps): React.ReactElement {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// Sport Icons - using @expo/vector-icons for professional quality
export function FootballIcon({ size = 24, color = colors.textPrimary }: IconProps): React.ReactElement {
  return <MaterialCommunityIcons name="soccer" size={size} color={color} />;
}

export function TennisIcon({ size = 24, color = colors.textPrimary }: IconProps): React.ReactElement {
  return <MaterialCommunityIcons name="tennis" size={size} color={color} />;
}

export function DartsIcon({ size = 24, color = colors.textPrimary }: IconProps): React.ReactElement {
  return <MaterialCommunityIcons name="bullseye-arrow" size={size} color={color} />;
}

export function CricketIcon({ size = 24, color = colors.textPrimary }: IconProps): React.ReactElement {
  return <MaterialCommunityIcons name="cricket" size={size} color={color} />;
}

export function BasketballIcon({ size = 24, color = colors.textPrimary }: IconProps): React.ReactElement {
  return <MaterialCommunityIcons name="basketball" size={size} color={color} />;
}

export function GolfIcon({ size = 24, color = colors.textPrimary }: IconProps): React.ReactElement {
  return <MaterialCommunityIcons name="golf" size={size} color={color} />;
}

export function BoxingIcon({ size = 24, color = colors.textPrimary }: IconProps): React.ReactElement {
  return <MaterialCommunityIcons name="boxing-glove" size={size} color={color} />;
}

export function MMAIcon({ size = 24, color = colors.textPrimary }: IconProps): React.ReactElement {
  return <MaterialCommunityIcons name="kabaddi" size={size} color={color} />;
}

// Status Icons
export function PendingIcon({ size = 24, color = colors.warning }: IconProps): React.ReactElement {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2" />
      <Path d="M12 6v6l4 2" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

export function WonIcon({ size = 24, color = colors.success }: IconProps): React.ReactElement {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="10" fill={color} fillOpacity="0.2" stroke={color} strokeWidth="2" />
      <Path d="M8 12l2.5 2.5L16 9" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function LostIcon({ size = 24, color = colors.error }: IconProps): React.ReactElement {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="10" fill={color} fillOpacity="0.2" stroke={color} strokeWidth="2" />
      <Path d="M8 8l8 8M16 8l-8 8" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

// Misc
export function SparkleIcon({ size = 24, color = colors.primary }: IconProps): React.ReactElement {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2l2 7h7l-5.5 4 2 7L12 16l-5.5 4 2-7L3 9h7l2-7z"
        fill={color}
        fillOpacity="0.2"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function CrownIcon({ size = 24, color = colors.stars }: IconProps): React.ReactElement {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M2 8l4 12h12l4-12-5 4-5-8-5 8-5-4z"
        fill={color}
        fillOpacity="0.2"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function EyeIcon({ size = 24, color = colors.textPrimary }: IconProps): React.ReactElement {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx="12" cy="12" r="3" stroke={color} strokeWidth="2" />
    </Svg>
  );
}

export function EyeOffIcon({ size = 24, color = colors.textPrimary }: IconProps): React.ReactElement {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M1 1l22 22" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

// Accumulator Icons
export function LayersIcon({ size = 24, color = colors.textPrimary }: IconProps): React.ReactElement {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2L2 7l10 5 10-5-10-5z"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M2 17l10 5 10-5"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M2 12l10 5 10-5"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function PlusIcon({ size = 24, color = colors.textPrimary }: IconProps): React.ReactElement {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 5v14M5 12h14"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function TrashIcon({ size = 24, color = colors.textPrimary }: IconProps): React.ReactElement {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function ChevronUpIcon({ size = 24, color = colors.textPrimary }: IconProps): React.ReactElement {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M18 15l-6-6-6 6"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function ChevronDownIcon({ size = 24, color = colors.textPrimary }: IconProps): React.ReactElement {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 9l6 6 6-6"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
