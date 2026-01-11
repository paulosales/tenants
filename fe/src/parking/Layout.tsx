import {type LayoutType} from '../types/parking';

type PropType = {
  layout: LayoutType;
};

const Layout = ({layout}: PropType) => {
  return (
    <rect
      key={layout.id}
      x={layout.x}
      y={layout.y}
      width={layout.width}
      height={layout.height}
      fill="none"
      stroke="black"
      strokeWidth="2"
    >
      <title>{layout.name}</title>
    </rect>
  );
};

export default Layout;
