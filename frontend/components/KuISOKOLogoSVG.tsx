

import React from 'react';
import { useAppContext } from '../context/AppContext';

interface KuISOKOLogoSVGProps {
  className?: string;
}

const KuISOKOLogoSVG: React.FC<KuISOKOLogoSVGProps> = ({ className }) => {
  const bagFill = '#0B5D3B'; // Original light mode color

  const handleStroke = '#F7931E'; // Original light mode color
  const checkStroke = '#F5B335'; // Original light mode color

  const kuisokoDarkGreen = '#0B5D3B'; // Original light mode color
  const kuisokoOrange1 = '#F7931E'; // Original light mode color
  const kuisokoOrange2 = '#F5B335'; // Original light mode color


  return (
    <svg className={className} viewBox="0 0 640 180" xmlns="http://www.w3.org/2000/svg">
      <g transform="translate(0,20)">
        <path d="M40 40 L140 40 L160 140 L20 140 Z" fill={bagFill} />
        <path d="M60 40 C60 10, 120 10, 120 40"
          stroke={handleStroke} strokeWidth="10" fill="none" />
        <path d="M55 90 L75 110 L115 70"
          stroke={checkStroke} strokeWidth="10"
          fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <text x="200" y="115"
        fontFamily="Inter, Arial, sans-serif"
        fontSize="80"
        fontWeight="700">
        <>
          <tspan fill={kuisokoDarkGreen}>Ku</tspan>
          <tspan fill={kuisokoOrange1}>I</tspan>
          <tspan fill={kuisokoOrange1}>s</tspan>
          <tspan fill={kuisokoOrange1}>o</tspan>
          <tspan fill={kuisokoOrange2}>k</tspan>
          <tspan fill={kuisokoOrange2}>o</tspan>
        </>
      </text>
    </svg>
  );
};

export default KuISOKOLogoSVG;
