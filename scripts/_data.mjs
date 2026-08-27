const USER = '00000000-0000-4000-8000-000000000001';
const day = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

export const DATA = {
    captures: [
        { id: 'cap1', user_id: USER, transcript: 'oh i want to check out that ramen place in hayes valley sometime', summary: 'Added "Ramen in Hayes Valley" to a new itinerary, A Hayes Valley Day.', actions: [{ tool: 'add_to_itinerary', table: 'day_plans', id: 'x1', label: 'A Hayes Valley Day' }, { tool: 'add_to_itinerary', table: 'plan_items', id: 'x2', label: 'Ramen in Hayes Valley' }], undone: false, created_at: new Date(Date.now() - 22 * 6e4).toISOString() },
        { id: 'cap2', user_id: USER, transcript: "we're out of oat milk and gochujang, and i keep thinking about that stamp choker", summary: 'Added 2 to the grocery list, and "Stamp Choker" to the Treasury.', actions: [{ tool: 'add_groceries', table: 'provisions', id: 'x3', label: 'oat milk' }, { tool: 'add_groceries', table: 'provisions', id: 'x4', label: 'gochujang' }, { tool: 'add_desire', table: 'treasury_items', id: 'x5', label: 'Stamp Choker' }], undone: false, created_at: new Date(Date.now() - 3 * 36e5).toISOString() },
        { id: 'cap3', user_id: USER, transcript: 'remind me to descale the kettle', summary: 'Added "descale the kettle" to Kitchen.', actions: [{ tool: 'add_chore', table: 'chores', id: 'x6', label: 'descale the kettle' }], undone: true, created_at: new Date(Date.now() - 26 * 36e5).toISOString() },
    ],
    habits: [
        { id: 'h1', user_id: USER, text: 'drink water', completed: true, last_completed: new Date().toDateString(), streak: 4 },
        { id: 'h2', user_id: USER, text: 'morning workout', completed: false, last_completed: null },
        { id: 'h3', user_id: USER, text: 'read 1 hour a day', completed: true, last_completed: new Date().toDateString() },
        { id: 'h4', user_id: USER, text: 'work on mojie', completed: false, last_completed: null },
        { id: 'h5', user_id: USER, text: 'read marathi / hindi books', completed: false, last_completed: null },
    ],
    todos: [
        { id: 't1', user_id: USER, text: 'create listable using claude', completed: false, created_at: new Date().toISOString() },
        { id: 't2', user_id: USER, text: 'set up claude entirely', completed: false, created_at: new Date().toISOString() },
        { id: 't3', user_id: USER, text: 'book the ferry tickets for the fjord trip', completed: true, created_at: new Date().toISOString() },
    ],
    chores: [
        { id: 'c1', user_id: USER, text: 'water the plants', room: 'Kitchen', completed: false, frequency: 'weekly' },
        { id: 'c2', user_id: USER, text: 'change the bed linen', room: 'Bedroom', completed: true, frequency: 'weekly' },
        { id: 'c3', user_id: USER, text: 'descale the kettle', room: 'Kitchen', completed: false, frequency: 'monthly' },
    ],
    goals: [
        { id: 'g1', user_id: USER, text: 'Run a half marathon', horizon: 'year', progress: 40, completed: false },
        { id: 'g2', user_id: USER, text: 'Finish the Marathi reader', horizon: 'month', progress: 65, completed: false },
    ],
    hobbies: [
        { id: 'hb1', user_id: USER, name: 'Stained glass', last_session: new Date().toISOString(), total_sessions: 12 },
        { id: 'hb2', user_id: USER, name: 'Film photography', last_session: new Date(Date.now() - 3 * 864e5).toISOString(), total_sessions: 30 },
    ],
    social_plans: [
        { id: 's1', user_id: USER, title: 'Dinner with Zeyi + Qing', when_date: day(3), status: 'confirmed', location: 'Mission' },
        { id: 's2', user_id: USER, title: 'Malvika + Nitin memorial day', when_date: day(14), status: 'pending', location: null },
    ],
    provisions: [
        { id: 'p1', user_id: USER, text: 'sesame oil', checked: false },
        { id: 'p2', user_id: USER, text: 'gochujang', checked: true },
        { id: 'p3', user_id: USER, text: 'unsalted butter', checked: false },
    ],
    workouts: [
        { id: 'w1', user_id: USER, day_of_week: new Date().toLocaleDateString('en-US', { weekday: 'long' }), title: 'Push + core', details: ['Bench 4x8', 'Overhead press 3x10', 'Plank 3x60s'] },
    ],
    library_items: [
        { id: 'l1', user_id: USER, title: 'Piranesi', creator: 'Susanna Clarke', type: 'books', rating: 5, status: 'finished', created_at: new Date().toISOString(), image_url: null },
        { id: 'l2', user_id: USER, title: 'Perfect Days', creator: 'Wim Wenders', type: 'movies', rating: 5, status: 'finished', created_at: new Date(Date.now() - 864e5).toISOString(), image_url: null },
        { id: 'l3', user_id: USER, title: 'The Bear', creator: 'FX', type: 'tv shows', rating: 4, status: 'watching', created_at: new Date(Date.now() - 2 * 864e5).toISOString(), image_url: null },
    ],
    treasury_items: [
        { id: 'ti1', user_id: USER, title: 'Indian Garden Wallpaper, Green', category: 'Home', price: '500', priority: 'Low', status: 'desired', url: 'https://example.com', image_url: null, notes: '' },
        { id: 'ti2', user_id: USER, title: 'Chopping Block + Knife, Notorious Foodie', category: 'Kitchen', price: '275', priority: 'Medium', status: 'desired', url: 'https://example.com', image_url: null, notes: '' },
        { id: 'ti3', user_id: USER, title: 'Lemon Squeezer, Fish', category: 'Kitchen', price: '38', priority: 'Low', status: 'acquired', url: 'https://example.com', image_url: null, notes: '' },
        { id: 'ti4', user_id: USER, title: 'Stamp Choker by Taylor Heller | Camóre', category: 'Closet', price: '370', priority: 'Low', status: 'desired', url: 'https://example.com', image_url: null, notes: '' },
    ],
    treasury_brands: [
        { id: 'tb1', user_id: USER, name: 'Camóre', url: 'https://example.com', notes: 'Good for quality linens and small silver.' },
    ],
    atlas_trips: [
        { id: 'a1', user_id: USER, destination: 'Fjord Norway', status: 'Dreaming', start_date: day(60), notes: '', cover_image_url: null, budget: 3200 },
        { id: 'a2', user_id: USER, destination: 'Napa Valley, CA', status: 'Planned', start_date: day(21), notes: '', cover_image_url: null, budget: 800 },
    ],
    atlas_waypoints: [{ id: 'wp1', user_id: USER, trip_id: 'a1', name: 'Bergen', lat: 60.39, lng: 5.32 }],
    recipes: [
        { id: 'r1', user_id: USER, title: 'Three-Cup Chicken', source: 'Imported', image_url: 'data:image/png;base64,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', instructions: 'Braise.', created_at: new Date().toISOString(), ingredients: [{ id: 'i1', item: 'sesame oil', amount: '3', unit: 'tablespoons' }, { id: 'i2', item: 'ginger', amount: '12', unit: 'pcs' }, { id: 'i3', item: 'garlic', amount: '12', unit: 'cloves' }] },
        { id: 'r2', user_id: USER, title: 'Charred Cabbage With Miso Browned Butter', source: 'Imported', instructions: 'Char.', created_at: new Date().toISOString(), ingredients: [{ id: 'i4', item: 'cabbage', amount: '1', unit: 'pcs' }, { id: 'i5', item: 'olive oil', amount: '1/4', unit: 'cup' }] },
        { id: 'r3', user_id: USER, title: 'Skillet Gnocchi With Miso Butter and Asparagus', source: 'Imported', instructions: 'Fry.', created_at: new Date().toISOString(), ingredients: [{ id: 'i6', item: 'gnocchi', amount: '1', unit: 'packet' }] },
        {
            id: 'r4', user_id: USER, title: 'Everyday Dal', source: 'Imported',
            instructions: 'Temper the spices, add the dal, simmer.',
            created_at: new Date().toISOString(),
            // Deliberately messy: an imperative line, a regional spice name, a
            // prep suffix and two things the pantry has never heard of. None of
            // these matched before the matcher existed.
            ingredients: [
                { id: 'i7', item: 'include a bay leaf', amount: '1', unit: 'pcs' },
                { id: 'i8', item: 'deggi mirch indian chilli powder', amount: '1', unit: 'tsp' },
                { id: 'i9', item: 'freshly ground black pepper', amount: '1', unit: 'tsp' },
                { id: 'i10', item: 'garlic', amount: '3', unit: 'cloves', notes: 'finely minced' },
                { id: 'i11', item: 'orange masoor dal', amount: '1', unit: 'cup' },
                { id: 'i12', item: 'gochujang', amount: '2', unit: 'tbsp' },
                { id: 'i13', item: 'curry leaves', amount: '10', unit: 'pcs' },
            ],
        },
    ],
    pantry_ingredients: [
        { id: 'pi1', user_id: USER, name: 'sesame oil', label: 'Sesame oil', category: 'Pantry', in_stock: true, icon: '🫗', aliases: [] },
        { id: 'pi2', user_id: USER, name: 'garlic', label: 'Garlic', category: 'Produce', in_stock: true, icon: '🧄', aliases: [] },
        { id: 'pi3', user_id: USER, name: 'cabbage', label: 'cabbage', category: 'Produce', in_stock: false, icon: '🥬', aliases: [] },
        { id: 'pi4', user_id: USER, name: 'bay leaf', label: 'bay leaf', category: 'Spices', in_stock: true, icon: '🌿', aliases: [] },
        { id: 'pi5', user_id: USER, name: 'red chilli powder', label: 'red chilli powder', category: 'Spices', in_stock: true, icon: '🌶️', aliases: [] },
        { id: 'pi6', user_id: USER, name: 'black pepper', label: 'black pepper', category: 'Spices', in_stock: true, icon: '🧂', aliases: [] },
        { id: 'pi7', user_id: USER, name: 'curry leaves', label: 'curry leaves', category: 'Produce', in_stock: true, icon: '🍃', aliases: [] },
        // Carries a taught alias, so the pantry tab shows what that looks like.
        { id: 'pi8', user_id: USER, name: 'orange masoor dal', label: 'orange masoor dal', category: 'Pantry', in_stock: false, icon: '🫘', aliases: ['red lentil', 'masoor dal'] },
        { id: 'pi9', user_id: USER, name: 'ginger', label: 'ginger', category: 'Produce', in_stock: true, icon: '🫚', aliases: [] },
    ],
    meal_plans: [{ id: 'mp1', user_id: USER, day_of_week: 'Monday', recipe_id: 'r1' }],
    day_plans: [
        { id: 'dp1', user_id: USER, title: 'Zeyi + Qing Day Trip!', location: 'Napa Valley, CA', plan_date: day(5) },
        { id: 'dp2', user_id: USER, title: 'Stained Glass Workshop', location: 'San Francisco, CA', plan_date: null },
        { id: 'dp3', user_id: USER, title: 'Curious Scents Day', location: 'Berkeley, California', plan_date: null },
    ],
    plan_items: [
        { id: 'pit1', plan_id: 'dp1', title: 'Drive up', start_time: '09:00:00', duration: '01:30', position: 0, category: 'travel' },
        { id: 'pit2', plan_id: 'dp1', title: 'Tasting at Ashes & Diamonds', start_time: '11:00:00', duration: '02:00', position: 1, category: 'food' },
    ],
    projects: [{ id: 'pr1', name: 'me.portal', color: 'var(--accent-gold)' }],
    project_tasks: [
        { id: 'pt1', project_id: 'pr1', title: 'Rebuild the design system', status: 'doing', position: 0 },
        { id: 'pt2', project_id: 'pr1', title: 'Capture the schema', status: 'todo', position: 0 },
    ],
    user_larder_menus: [],
    user_larder_menu_recipes: [],
    user_news_config: [],
    recipe_tags: [{ id: 'tg1', user_id: USER, recipe_id: 'r1', tag: 'weeknight' }],
    ingredients: [],
};
