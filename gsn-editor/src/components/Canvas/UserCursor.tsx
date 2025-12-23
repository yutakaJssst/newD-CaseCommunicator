import React from 'react';

interface UserCursorProps {
  userName: string;
  x: number;
  y: number;
  color: string;
}

export const UserCursor: React.FC<UserCursorProps> = ({ userName, x, y, color }) => {
  return (
    <g transform={`translate(${x}, ${y})`} style={{ pointerEvents: 'none' }}>
      {/* カーソルアイコン（矢印） */}
      <path
        d="M 0 0 L 0 16 L 4 12 L 7 18 L 9 17 L 6 11 L 11 11 Z"
        fill={color}
        stroke="white"
        strokeWidth="1"
      />

      {/* ユーザー名ラベル */}
      <g transform="translate(12, -5)">
        <rect
          x="0"
          y="0"
          width={userName.length * 7 + 10}
          height="20"
          rx="3"
          fill={color}
          opacity="0.9"
        />
        <text
          x="5"
          y="14"
          fill="white"
          fontSize="12"
          fontWeight="bold"
        >
          {userName}
        </text>
      </g>
    </g>
  );
};
