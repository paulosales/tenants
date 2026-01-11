export type ParkingType = {
  x: number;
  y: number;
  width: number;
  height: number;
  doors: DoorType[];
  layouts: LayoutType[];
  spots: SpotType[];
};

export type DoorType = {
  id: number;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type LayoutType = {
  id: number;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type SpotType = {
  id: number;
  number: string;
  x: number;
  y: number;
  width: number;
  height: number;
  assignedTo: TenantType | null;
};

export type TenantType = {
  tenantId: number;
  name: string;
  unit: string;
  assinmentDate: string; // ISO date string
};
