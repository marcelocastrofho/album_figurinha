export interface Sticker {
  id: number;
  name: string;
  category: string;
  image_url: string;
  rarity: 'common' | 'rare' | 'legendary';
}

export interface CollectionItem extends Sticker {
  sticker_id: number;
  quantity: number;
  is_stuck: boolean;
}

export interface SwapItem extends Sticker {
  id: number;
  sticker_id: number;
  user_id: string;
  status: string;
}
