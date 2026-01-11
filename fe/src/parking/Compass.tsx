type PropType = {
  angle: number;
};

const Compass = ({angle}: PropType) => {
  const centerX = 1110;
  const centerY = 70;
  const pointerLength = 20;
  return (
    <g transform={`rotate(${angle}, ${centerX}, ${centerY})`}>
      <circle cx={centerX} cy={centerY} r={28} fill="white" stroke="black" strokeWidth={2} />
      <line
        x1={centerX}
        y1={centerY + pointerLength}
        x2={centerX}
        y2={centerY - pointerLength}
        stroke="red"
        strokeWidth={2}
      />
      <line
        x1={centerX + pointerLength}
        y1={centerY}
        x2={centerX - pointerLength}
        y2={centerY}
        stroke="black"
        strokeWidth={2}
      />
      <text x={centerX - 4} y={centerY - 32} fontSize={12} fill="black">
        N
      </text>
      <text x={centerX + 32} y={centerY + 4} fontSize={12} fill="black">
        E
      </text>
    </g>
  );
};

export default Compass;
