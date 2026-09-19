import React from 'react';
import { PantryContext, usePantryStore } from '../hooks/useIngredients';

/**
 * One pantry for the whole app.
 *
 * Mounted above the routes rather than inside a page, for two reasons. The
 * Larder page and the shopping list living on it were each mounting their own
 * copy and disagreeing with each other about what was in stock. And walking
 * from the dashboard to the Larder and back used to re-read the whole pantry
 * every time; now it is read once and stays read.
 */
const PantryProvider = ({ children }) => (
    <PantryContext.Provider value={usePantryStore()}>
        {children}
    </PantryContext.Provider>
);

export default PantryProvider;
