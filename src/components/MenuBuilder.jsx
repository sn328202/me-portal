import React, { useState, useMemo, useEffect } from 'react';
import { GiCook, GiMeal, GiClockwork, GiTrashCan, GiCheckMark, GiFeather, GiScrollQuill, GiMagicPotion, GiPencil, GiThirdEye } from 'react-icons/gi';
import MenuView from './MenuView';

const MenuBuilder = ({ recipes, menus, onSaveMenu, onUpdateMenu, onDeleteMenu }) => {
    const [isCreating, setIsCreating] = useState(false);
    const [viewingMenu, setViewingMenu] = useState(null);
    const [editingId, setEditingId] = useState(null);
    const [newMenu, setNewMenu] = useState({ title: '', occasion: '', notes: '' });
    const [selectedRecipes, setSelectedRecipes] = useState([]); // Array of { recipe_id, course_name, title, image_url }
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCourse, setActiveCourse] = useState('Main Course');

    const courses = ["Appetizer", "Starter", "Main Course", "Side", "Dessert", "Potable"];

    // Aggregate stats calculation
    const stats = useMemo(() => {
        let totalPrep = 0;
        let totalCook = 0;

        selectedRecipes.forEach(mr => {
            const recipe = recipes.find(r => r.id === mr.recipe_id);
            if (recipe) {
                const parse = (timeStr) => {
                    if (!timeStr) return 0;
                    const hMatch = String(timeStr).match(/(\d+)\s*h/i);
                    const mMatch = String(timeStr).match(/(\d+)\s*m/i);
                    let total = 0;
                    if (hMatch) total += parseInt(hMatch[1]) * 60;
                    if (mMatch) total += parseInt(mMatch[1]);
                    return total || parseInt(timeStr) || 0;
                };
                totalPrep += parse(recipe.prep_time);
                totalCook += parse(recipe.cook_time);
            }
        });

        const format = (mins) => {
            if (mins === 0) return '0m';
            const h = Math.floor(mins / 60);
            const m = mins % 60;
            return `${h > 0 ? h + 'h ' : ''}${m > 0 ? m + 'm' : ''}`.trim();
        };

        return {
            prep: format(totalPrep),
            cook: format(totalCook),
            total: format(totalPrep + totalCook),
            count: selectedRecipes.length
        };
    }, [selectedRecipes, recipes]);

    const filteredRecipes = useMemo(() => {
        const q = searchQuery.toLowerCase();
        if (!q) return recipes.slice(0, 20); // Show more by default
        return recipes.filter(r =>
            r.title.toLowerCase().includes(q) ||
            r.tags?.some(t => t.toLowerCase().includes(q))
        ).slice(0, 20);
    }, [recipes, searchQuery]);

    const handleAddRecipe = (recipe) => {
        setSelectedRecipes([...selectedRecipes, {
            recipe_id: recipe.id,
            course_name: activeCourse,
            title: recipe.title,
            image_url: recipe.image_url
        }]);
    };

    const handleRemoveRecipe = (index) => {
        setSelectedRecipes(selectedRecipes.filter((_, i) => i !== index));
    };

    const handleSave = async () => {
        if (!newMenu.title) return alert("A theme requires a title.");
        if (editingId) {
            await onUpdateMenu(editingId, newMenu, selectedRecipes);
        } else {
            await onSaveMenu(newMenu, selectedRecipes);
        }
        handleClose();
    };

    const handleEdit = (menu) => {
        setEditingId(menu.id);
        setNewMenu({
            title: menu.title,
            occasion: menu.occasion || '',
            notes: menu.notes || ''
        });
        const mRecipes = menu.user_larder_menu_recipes?.map(mr => ({
            recipe_id: mr.recipe_id,
            course_name: mr.course_name,
            title: mr.recipes?.title,
            image_url: mr.recipes?.image_url
        })) || [];
        setSelectedRecipes(mRecipes);
        setIsCreating(true);
    };

    const handleClose = () => {
        setIsCreating(false);
        setEditingId(null);
        setNewMenu({ title: '', occasion: '', notes: '' });
        setSelectedRecipes([]);
        setSearchQuery('');
    };

    const groupedSelection = selectedRecipes.reduce((acc, mr) => {
        if (!acc[mr.course_name]) acc[mr.course_name] = [];
        acc[mr.course_name].push(mr);
        return acc;
    }, {});

    if (isCreating) {
        return (
            <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '2rem', height: '100%' }}>
                {/* Left: Recipe Archive */}
                <div style={{ borderRight: '1px solid var(--border-dim)', paddingRight: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <h3 style={{ fontFamily: 'var(--font-display)', color: 'var(--text-gold)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <GiScrollQuill /> THE ARCHIVES
                    </h3>
                    <input
                        type="text"
                        placeholder="Seek formula..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && filteredRecipes.length > 0) {
                                handleAddRecipe(filteredRecipes[0]);
                                setSearchQuery('');
                            }
                        }}
                        autoFocus
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-dim)', color: 'var(--text-main)', padding: '8px', fontSize: '0.9rem' }}
                    />
                    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {filteredRecipes.map(r => (
                            <div key={r.id}
                                onClick={() => handleAddRecipe(r)}
                                style={{
                                    padding: '8px',
                                    background: 'var(--bg-panel)',
                                    border: '1px solid var(--border-dim)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    gap: '10px',
                                    alignItems: 'center',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--accent-gold)'}
                                onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-dim)'}
                            >
                                <div style={{ width: '40px', height: '40px', background: 'var(--bg-hover)', borderRadius: '2px', overflow: 'hidden' }}>
                                    {r.image_url ? <img src={r.image_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : <GiCook size={20} style={{ margin: '10px', opacity: 0.3 }} />}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontSize: '0.9rem' }}>{r.title}</span>
                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{r.total_time || 'No time set'}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right: Menu Canvas */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
                            <input
                                type="text"
                                placeholder="A Menu for..."
                                value={newMenu.title}
                                onChange={(e) => setNewMenu({ ...newMenu, title: e.target.value })}
                                style={{ background: 'transparent', border: 'none', borderBottom: '2px solid var(--accent-gold)', color: 'var(--text-main)', fontSize: '1.5rem', fontFamily: 'var(--font-display)', outline: 'none', width: '80%' }}
                            />
                            <input
                                type="text"
                                placeholder="The Occasion (Optional)"
                                value={newMenu.occasion}
                                onChange={(e) => setNewMenu({ ...newMenu, occasion: e.target.value })}
                                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '0.9rem', outline: 'none' }}
                            />
                        </div>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button onClick={handleClose} style={{ background: 'transparent', border: '1px solid var(--border-dim)', color: 'var(--text-muted)', padding: '8px 16px', cursor: 'pointer' }}>ABANDON</button>
                            <button onClick={handleSave} style={{ background: 'var(--accent-gold)', border: 'none', color: 'var(--bg-main)', padding: '8px 16px', cursor: 'pointer', fontWeight: 'bold' }}>{editingId ? 'UPDATED SEAL' : 'SEAL MENU'}</button>
                        </div>
                    </div>

                    {/* Stats Ribbon */}
                    <div style={{ display: 'flex', gap: '2rem', padding: '1rem', background: 'rgba(207, 181, 59, 0.05)', border: '1px solid var(--border-gold)', fontStyle: 'italic', color: 'var(--text-gold)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><GiClockwork /> Total Labor: {stats.total}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><GiMeal /> Components: {stats.count}</div>
                    </div>

                    {/* Course Selection */}
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {courses.map(c => (
                            <button
                                key={c}
                                onClick={() => setActiveCourse(c)}
                                style={{
                                    padding: '4px 12px',
                                    background: activeCourse === c ? 'var(--accent-gold)' : 'transparent',
                                    color: activeCourse === c ? 'var(--bg-main)' : 'var(--text-gold)',
                                    border: '1px solid var(--accent-gold)',
                                    cursor: 'pointer',
                                    fontSize: '0.8rem',
                                    textTransform: 'uppercase'
                                }}
                            >
                                {c}
                            </button>
                        ))}
                    </div>

                    {/* Menu Content */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', border: '1px dashed var(--border-dim)', minHeight: '300px' }}>
                        {Object.keys(groupedSelection).length === 0 && (
                            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                The page is blank. Select formulae from the archive to begin.
                            </div>
                        )}
                        {courses.map(course => groupedSelection[course] && (
                            <div key={course} style={{ marginBottom: '2rem' }}>
                                <h4 style={{ fontFamily: 'var(--font-display)', color: 'var(--accent-gold)', borderBottom: '1px solid rgba(207, 181, 59, 0.2)', paddingBottom: '4px', marginBottom: '1rem', textTransform: 'uppercase' }}>{course}</h4>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
                                    {groupedSelection[course].map((mr, idx) => (
                                        <div key={idx} style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-dim)', padding: '10px', display: 'flex', gap: '10px', position: 'relative' }}>
                                            <div style={{ width: '50px', height: '50px', background: 'var(--bg-hover)' }}>
                                                {mr.image_url && <img src={mr.image_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />}
                                            </div>
                                            <span style={{ fontSize: '0.9rem', flex: 1 }}>{mr.title}</span>
                                            <button
                                                onClick={() => handleRemoveRecipe(selectedRecipes.indexOf(mr))}
                                                style={{ border: 'none', background: 'transparent', color: 'var(--accent-crimson)', cursor: 'pointer', position: 'absolute', top: '5px', right: '5px' }}
                                            >
                                                <GiTrashCan />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Curate your grandest menus for the most exceptional occasions.</p>
                <button
                    onClick={() => setIsCreating(true)}
                    style={{ padding: '8px 20px', background: 'var(--accent-gold)', border: 'none', color: 'var(--bg-main)', cursor: 'pointer', fontFamily: 'var(--font-display)', fontWeight: 'bold' }}
                >
                    + NEW MENU
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
                {menus.map(menu => (
                    <div key={menu.id} style={{
                        background: 'var(--bg-panel)',
                        border: 'var(--border-double)',
                        padding: '1.5rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1rem',
                        position: 'relative'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                                <h3 style={{ margin: 0, fontFamily: 'var(--font-display)', color: 'var(--text-gold)', fontSize: '1.4rem' }}>{menu.title}</h3>
                                <p style={{ margin: '4px 0', fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{menu.occasion || 'General Feast'}</p>
                            </div>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button
                                    onClick={() => setViewingMenu(menu)}
                                    title="View Menu"
                                    style={{ border: 'none', background: 'transparent', color: 'var(--accent-gold)', cursor: 'pointer', opacity: 1 }}
                                >
                                    <GiThirdEye size={20} />
                                </button>
                                <button
                                    onClick={() => handleEdit(menu)}
                                    title="Edit Menu"
                                    style={{ border: 'none', background: 'transparent', color: 'var(--text-gold)', cursor: 'pointer', opacity: 0.6 }}
                                >
                                    <GiPencil size={20} />
                                </button>
                                <button
                                    onClick={() => onDeleteMenu(menu.id)}
                                    title="Delete Menu"
                                    style={{ border: 'none', background: 'transparent', color: 'var(--accent-crimson)', cursor: 'pointer', opacity: 0.6 }}
                                >
                                    <GiTrashCan size={20} />
                                </button>
                            </div>
                        </div>

                        <div style={{ borderBottom: '1px dashed var(--border-dim)' }}></div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {menu.user_larder_menu_recipes?.slice(0, 3).map((mr, idx) => (
                                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem' }}>
                                    <div style={{ width: '30px', height: '30px', background: 'var(--bg-hover)', borderRadius: '2px', overflow: 'hidden' }}>
                                        {mr.recipes?.image_url && <img src={mr.recipes.image_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />}
                                    </div>
                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>{mr.course_name}:</span>
                                    <span>{mr.recipes?.title}</span>
                                </div>
                            ))}
                            {(menu.user_larder_menu_recipes?.length || 0) > 3 && (
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>+ {menu.user_larder_menu_recipes.length - 3} more formulae...</span>
                            )}
                        </div>

                        <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-gold)' }}>
                            <span><GiMagicPotion /> {menu.user_larder_menu_recipes?.length || 0} Dishes</span>
                            <span>{new Date(menu.created_at).toLocaleDateString()}</span>
                        </div>
                    </div>
                ))}
            </div>

            {menus.length === 0 && (
                <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border-dim)' }}>
                    <GiMeal size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                    <p>No menus have been curated yet.</p>
                </div>
            )}
            {viewingMenu && (
                <MenuView
                    menu={viewingMenu}
                    recipes={recipes}
                    onClose={() => setViewingMenu(null)}
                />
            )}
        </div>
    );
};

export default MenuBuilder;
