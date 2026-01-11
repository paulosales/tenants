import {type SpotType} from '../types/parking';

type PropType = {
  spot: SpotType;
};

const Spot = ({spot}: PropType) => {
  const deltaY = Math.round(spot.assignedTo ? spot.height / 3.3 : spot.height / 2.5);
  const assinmentData = spot.assignedTo
    ? `Assiged on ${spot.assignedTo?.assinmentDate} to ${spot.assignedTo?.name} (unit ${spot.assignedTo?.unit}).`
    : '';
  return (
    <g>
      <rect
        key={spot.id}
        x={spot.x}
        y={spot.y}
        width={spot.width}
        height={spot.height}
        fill={spot.assignedTo ? 'lightgreen' : 'lightgray'}
        stroke="black"
      >
        <title>
          Spot {spot.number}. {assinmentData}
        </title>
      </rect>
      <text
        x={spot.x + spot.width / 2}
        y={spot.y + deltaY}
        textAnchor="middle"
        alignmentBaseline="central"
        fontSize="16"
        fontWeight={800}
        fill="black"
      >
        {spot.number}
      </text>
      <text
        x={spot.x + spot.width / 2}
        y={spot.y + 10 + deltaY}
        textAnchor="middle"
        alignmentBaseline="hanging"
        fontSize="10"
        fill="black"
      >
        {spot.assignedTo ? spot.assignedTo.name : 'Available'}
      </text>
      <text
        x={spot.x + spot.width / 2}
        y={spot.y + 20 + deltaY}
        textAnchor="middle"
        alignmentBaseline="hanging"
        fontSize="10"
        fill="black"
      >
        {spot.assignedTo ? `Unit ${spot.assignedTo.unit}` : ''}
      </text>
    </g>
  );
};

export default Spot;
