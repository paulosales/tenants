import {type DoorType} from '../types/parking';

type PropType = {
  door: DoorType;
};

const Door = ({door}: PropType) => {
  return (
    <rect key={door.id} x={door.x} y={door.y} width={door.width} height={door.height} fill="brown" stroke="black">
      <title>{door.name}</title>
    </rect>
  );
};

export default Door;
