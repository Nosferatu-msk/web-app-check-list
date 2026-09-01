export type RoomIconName =
  | 'lightning-bolt'
  | 'server'
  | 'account-group'
  | 'silverware-fork-knife'
  | 'toilet'
  | 'home-roof'
  | 'office-building'
  | 'kiosk'
  | 'door'
  | 'radiator'
  | 'cash'
  | 'package-variant';

const ROOM_ICONS: Record<string, RoomIconName> = {
  electric_room: 'lightning-bolt',
  server_room: 'server',
  client_hall: 'account-group',
  food_room: 'silverware-fork-knife',
  bathroom: 'toilet',
  roof: 'home-roof',
  facade: 'office-building',
  self_service: 'kiosk',
  porch: 'door',
  heat_unit: 'radiator',
  cashbox: 'cash',
  khc: 'package-variant',
};

export function getRoomIcon(code?: string): RoomIconName {
  if (!code) return 'office-building';
  return ROOM_ICONS[code] || 'office-building';
}
