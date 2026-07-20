export type LootItemId =
  | 'red-potion'
  | 'blue-potion'
  | 'ruby'
  | 'gold-nugget'
  | 'gold-bar'
  | 'heart'
  | 'meat'
  | 'pouch'

export type LootItemDefinition = {
  id: LootItemId
  name: string
  src: string
  /** Relative chance when rolling a drop table. */
  weight: number
}

export const LOOT_ITEMS: LootItemDefinition[] = [
  {
    id: 'red-potion',
    name: 'Red Potion',
    src: '/assets/minifantasy/items/red-potion.png',
    weight: 3,
  },
  {
    id: 'blue-potion',
    name: 'Blue Potion',
    src: '/assets/minifantasy/items/blue-potion.png',
    weight: 2,
  },
  {
    id: 'ruby',
    name: 'Ruby',
    src: '/assets/minifantasy/items/ruby.png',
    weight: 2,
  },
  {
    id: 'gold-nugget',
    name: 'Gold Ore',
    src: '/assets/minifantasy/items/gold-nugget.png',
    weight: 3,
  },
  {
    id: 'gold-bar',
    name: 'Gold Bar',
    src: '/assets/minifantasy/items/gold-bar.png',
    weight: 1,
  },
  {
    id: 'heart',
    name: 'Heart',
    src: '/assets/minifantasy/items/heart.png',
    weight: 2,
  },
  {
    id: 'meat',
    name: 'Meat',
    src: '/assets/minifantasy/items/meat.png',
    weight: 2,
  },
  {
    id: 'pouch',
    name: 'Coin Pouch',
    src: '/assets/minifantasy/items/pouch.png',
    weight: 2,
  },
]

export function lootItemById(id: LootItemId): LootItemDefinition {
  const item = LOOT_ITEMS.find((candidate) => candidate.id === id)
  if (!item) throw new Error(`Unknown loot item: ${id}`)
  return item
}

export function rollLootItem(random = Math.random): LootItemDefinition {
  const total = LOOT_ITEMS.reduce((sum, item) => sum + item.weight, 0)
  let roll = random() * total
  for (const item of LOOT_ITEMS) {
    roll -= item.weight
    if (roll <= 0) return item
  }
  return LOOT_ITEMS[LOOT_ITEMS.length - 1]
}
