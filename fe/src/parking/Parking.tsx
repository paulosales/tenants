import Compass from './Compass';
import {parking} from '../data/parking';
import Door from './Door';
import Layout from './Layout';
import Spot from './Spot';

const Parking = () => {
  return (
    <div>
      <svg width={parking.width} height={parking.height}>
        <Compass angle={120} />
        {parking.layouts.map((layout) => (
          <Layout key={layout.id} layout={layout} />
        ))}
        {parking.doors.map((door) => (
          <Door key={door.id} door={door} />
        ))}
        {parking.spots.map((spot) => (
          <Spot key={spot.id} spot={spot} />
        ))}
      </svg>
    </div>
  );
};

export default Parking;
