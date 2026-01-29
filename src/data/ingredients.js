// A dictionary to map loose terms to a standard definition
// Keys should be lower case for easier matching

export const INGREDIENT_LIBRARY = {
    // PRODUCE
    'onion': { icon: '🧅', category: 'Produce', defaultUnit: 'pcs', label: 'Onion' },
    'garlic': { icon: '🧄', category: 'Produce', defaultUnit: 'cloves', label: 'Garlic' },
    'carrot': { icon: '🥕', category: 'Produce', defaultUnit: 'pcs', label: 'Carrot' },
    'chili': { icon: '🌶️', category: 'Produce', defaultUnit: 'pcs', label: 'Chili' },
    'tomato': { icon: '🍅', category: 'Produce', defaultUnit: 'pcs', label: 'Tomato' },
    'potato': { icon: '🥔', category: 'Produce', defaultUnit: 'pcs', label: 'Potato' },

    // PROTEIN
    'chicken': { icon: '🍗', category: 'Protein', defaultUnit: 'g', label: 'Chicken' },
    'beef': { icon: '🥩', category: 'Protein', defaultUnit: 'g', label: 'Beef' },
    'fish': { icon: '🐟', category: 'Protein', defaultUnit: 'g', label: 'Fish' },
    'egg': { icon: '🥚', category: 'Protein', defaultUnit: 'pcs', label: 'Eggs' },

    // DAIRY
    'milk': { icon: '🥛', category: 'Dairy', defaultUnit: 'ml', label: 'Milk' },
    'cheese': { icon: '🧀', category: 'Dairy', defaultUnit: 'g', label: 'Cheese' },
    'butter': { icon: '🧈', category: 'Dairy', defaultUnit: 'g', label: 'Butter' },

    // PANTRY
    'bread': { icon: '🍞', category: 'Pantry', defaultUnit: 'loaf', label: 'Bread' },
    'flour': { icon: '🌾', category: 'Pantry', defaultUnit: 'g', label: 'Flour' },
    'rice': { icon: '🍚', category: 'Pantry', defaultUnit: 'g', label: 'Rice' },
    'oil': { icon: '🍾', category: 'Pantry', defaultUnit: 'ml', label: 'Olive Oil' },
    'salt': { icon: '🧂', category: 'Pantry', defaultUnit: 'pinch', label: 'Salt' },
};

// Helper to Fuzzy Match
export const findIngredient = (text) => {
    const lower = text.toLowerCase();
    const keys = Object.keys(INGREDIENT_LIBRARY);

    // 1. Direct match
    if (INGREDIENT_LIBRARY[lower]) return { id: lower, ...INGREDIENT_LIBRARY[lower] };

    // 2. Contains match (e.g. "Red Onion" -> matches "onion")
    // We prioritize longer keys? No, keys are simple.
    for (let key of keys) {
        if (lower.includes(key)) {
            return { id: key, ...INGREDIENT_LIBRARY[key] };
        }
    }

    return null;
};
