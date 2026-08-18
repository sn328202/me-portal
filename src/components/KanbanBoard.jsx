import React, { useState, useEffect } from 'react';
import { GiRoundBottomFlask, GiTestTubes, GiCheckMark, GiFeather, GiTiedScroll } from 'react-icons/gi';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

const KanbanBoard = () => {
    const { user } = useAuth();
    const [projects, setProjects] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);

    // --- State: UI ---
    const [newProjectName, setNewProjectName] = useState('');
    const [selectedProjectFilter, setSelectedProjectFilter] = useState('All');
    const [addingToColumn, setAddingToColumn] = useState(null); // Column ID being added to
    const [editingTask, setEditingTask] = useState(null); // Task ID being edited
    const [deleteConfirm, setDeleteConfirm] = useState(null); // ID of item being confirmed for delete (proj or task)

    // Config: Columns
    const COLUMNS = {
        backlog: { id: 'backlog', title: 'Ideas & Backlog', icon: GiFeather, color: '#795548' },
        inprogress: { id: 'inprogress', title: 'In the Workshop', icon: GiRoundBottomFlask, color: '#d84315' },
        review: { id: 'review', title: 'Review', icon: GiTestTubes, color: '#fbc02d' },
        deployed: { id: 'deployed', title: 'Deployed', icon: GiCheckMark, color: '#2e7d32' }
    };

    // Load Filter Preference
    useEffect(() => {
        if (user) {
            const saved = localStorage.getItem(`me_portal_kanban_filter_${user.id}`);
            if (saved) setSelectedProjectFilter(saved);
        }
    }, [user]);

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        if (user) {
            localStorage.setItem(`me_portal_kanban_filter_${user.id}`, selectedProjectFilter);
        }
    }, [selectedProjectFilter, user]);

    const fetchData = async () => {
        setLoading(true);
        // Fetch Projects
        const { data: projData, error: projError } = await supabase
            .from('projects')
            .select('*')
            .order('created_at', { ascending: true });

        if (projError) console.error('Error fetching projects:', projError);
        else setProjects(projData || []);

        // Fetch Tasks
        const { data: taskData, error: taskError } = await supabase
            .from('project_tasks')
            .select('*')
            .order('sort_order', { ascending: true });

        if (taskError) console.error('Error fetching tasks:', taskError);
        else setTasks(taskData || []);

        setLoading(false);
    };

    // --- Handlers: Projects ---
    const handleAddProject = async (e) => {
        e.preventDefault();
        if (!newProjectName.trim()) return;
        const colors = ['#5d4037', '#00695c', '#c62828', '#283593', '#4e342e', '#f9a825'];
        const randomColor = colors[Math.floor(Math.random() * colors.length)];

        const { data, error } = await supabase
            .from('projects')
            .insert([{ name: newProjectName, color: randomColor }])
            .select();

        if (error) {
            console.error(error);
            alert('Failed to create project');
        } else {
            setProjects([...projects, data[0]]);
            setNewProjectName('');
            if (projects.length === 0) setSelectedProjectFilter(data[0].id);
        }
    };

    const handleDeleteProject = async (pid) => {
        if (deleteConfirm === pid) {
            const { error } = await supabase.from('projects').delete().eq('id', pid);
            if (error) {
                console.error(error);
                alert('Failed to delete project');
            } else {
                setProjects(prev => prev.filter(p => p.id !== pid));
                setTasks(prev => prev.filter(t => t.project_id !== pid));
                if (selectedProjectFilter === pid) setSelectedProjectFilter('All');
                setDeleteConfirm(null);
            }
        } else {
            setDeleteConfirm(pid);
            setTimeout(() => setDeleteConfirm(null), 3000);
        }
    };


    // --- Handlers: Tasks ---
    const handleSaveNewTask = async (e, columnId) => {
        e.preventDefault();
        const title = e.target.elements.taskTitle.value;
        if (!title.trim()) {
            setAddingToColumn(null);
            return;
        }

        // Default to first project if 'All' is selected, or use filtered project
        let projectId = projects[0]?.id;
        if (selectedProjectFilter !== 'All') projectId = selectedProjectFilter;

        if (!projectId) {
            alert("Please create a project first!");
            setAddingToColumn(null);
            return;
        }

        const { data, error } = await supabase
            .from('project_tasks')
            .insert([{
                title,
                status: columnId,
                project_id: projectId
            }])
            .select();

        if (error) {
            console.error(error);
            alert('Failed to create task');
        } else {
            setTasks([...tasks, data[0]]);
            setAddingToColumn(null);
        }
    };

    const handleUpdateTaskTitle = async (e, taskId) => {
        e.preventDefault();
        const newTitle = e.target.elements.editTitle.value;
        if (newTitle.trim()) {
            const { error } = await supabase
                .from('project_tasks')
                .update({ title: newTitle })
                .eq('id', taskId);

            if (error) {
                console.error(error);
            } else {
                setTasks(prev => prev.map(t => t.id === taskId ? { ...t, title: newTitle } : t));
            }
        }
        setEditingTask(null);
    };

    const handleMoveTask = async (taskId, direction) => {
        const task = tasks.find(t => t.id === taskId);
        if (!task) return;

        const colKeys = Object.keys(COLUMNS);
        const idx = colKeys.indexOf(task.status);
        const newIdx = idx + direction;

        if (newIdx >= 0 && newIdx < colKeys.length) {
            const newStatus = colKeys[newIdx];

            // Optimistic Update
            setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));

            const { error } = await supabase
                .from('project_tasks')
                .update({ status: newStatus })
                .eq('id', taskId);

            if (error) {
                console.error(error);
                // Revert if failed
                setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: task.status } : t));
            }
        }
    };

    const handleDeleteTask = async (taskId) => {
        if (deleteConfirm === taskId) {
            // Optimistic
            setTasks(prev => prev.filter(t => t.id !== taskId));
            setDeleteConfirm(null);

            const { error } = await supabase.from('project_tasks').delete().eq('id', taskId);
            if (error) {
                console.error(error);
                // Actually hard to revert a delete easily without refetching or keeping copy.
                // Just alert user.
                alert('Failed to delete task');
                fetchData(); // Sync back
            }
        } else {
            setDeleteConfirm(taskId);
            setTimeout(() => setDeleteConfirm(null), 3000);
        }
    };

    // Filter Logic
    const filteredTasks = selectedProjectFilter === 'All'
        ? tasks
        : tasks.filter(t => t.project_id === selectedProjectFilter);


    return (
        <div style={{ padding: '1rem', fontFamily: 'var(--font-mono)', height: '100%', display: 'flex', flexDirection: 'column' }}>

            {/* --- Control Deck --- */}
            <div style={{ padding: '1rem', background: 'var(--bg-panel)', borderRadius: '4px', border: '1px solid var(--border-gold)', marginBottom: '1rem', display: 'flex', flexWrap: 'wrap', gap: '2rem', alignItems: 'center', justifyContent: 'space-between' }}>

                {/* Project Filter */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <label style={{ fontWeight: 'bold', color: 'var(--text-gold)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <GiTiedScroll size={20} /> Active Project:
                    </label>
                    <select
                        value={selectedProjectFilter}
                        onChange={(e) => setSelectedProjectFilter(e.target.value)}
                        style={{ padding: '0.5rem', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-dim)', color: 'var(--text-main)', minWidth: '150px' }}
                    >
                        <option value="All">All Projects</option>
                        {projects.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                    {selectedProjectFilter !== 'All' && (
                        <button
                            onClick={() => handleDeleteProject(selectedProjectFilter)}
                            style={{
                                fontSize: '0.8rem',
                                color: deleteConfirm === selectedProjectFilter ? 'var(--text-main)' : 'var(--accent-crimson)',
                                background: deleteConfirm === selectedProjectFilter ? 'var(--accent-crimson)' : 'transparent',
                                border: 'none', cursor: 'pointer', textDecoration: deleteConfirm === selectedProjectFilter ? 'none' : 'underline',
                                padding: deleteConfirm === selectedProjectFilter ? '0.2rem 0.5rem' : '0',
                                borderRadius: '4px'
                            }}
                        >
                            {deleteConfirm === selectedProjectFilter ? 'Confim Dissolve?' : 'Dissolve Project'}
                        </button>
                    )}
                </div>

                {/* Add New Project */}
                <form onSubmit={handleAddProject} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input
                        type="text"
                        value={newProjectName}
                        onChange={(e) => setNewProjectName(e.target.value)}
                        placeholder="New Project Name..."
                        style={{ padding: '0.5rem', border: '1px solid var(--border-dim)', background: 'rgba(0,0,0,0.2)', color: 'var(--text-main)', width: '200px' }}
                    />
                    <button type="submit" style={{ padding: '0.5rem 1rem', background: 'var(--accent-gold)', color: 'var(--bg-main)', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>
                        Create Project
                    </button>
                </form>
            </div>


            {/* --- The Board --- */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', flex: 1, alignItems: 'start', overflow: 'hidden' }}>
                {Object.values(COLUMNS).map(col => (
                    <div key={col.id} style={{
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px dashed var(--border-dim)',
                        borderRadius: '4px',
                        display: 'flex',
                        flexDirection: 'column',
                        height: '100%',
                        overflow: 'hidden'
                    }}>
                        {/* Column Header */}
                        <div style={{
                            padding: '0.75rem',
                            background: 'var(--bg-panel)',
                            borderBottom: '1px solid var(--border-dim)',
                            color: 'var(--text-main)',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            flexShrink: 0
                        }}>
                            <span style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <col.icon color={col.color} /> {col.title}
                            </span>
                            <button
                                onClick={() => setAddingToColumn(col.id)}
                                title="Add Task to this Column"
                                style={{
                                    background: col.color, color: '#fff',
                                    border: 'none', borderRadius: '50%',
                                    width: '24px', height: '24px',
                                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '1.2rem', paddingBottom: '2px'
                                }}
                            >
                                +
                            </button>
                        </div>

                        {/* Quick Add Form */}
                        {addingToColumn === col.id && (
                            <div style={{ padding: '0.5rem', background: 'var(--bg-panel)', borderBottom: '1px solid var(--border-dim)' }}>
                                <form onSubmit={(e) => handleSaveNewTask(e, col.id)}>
                                    <input
                                        name="taskTitle"
                                        autoFocus
                                        placeholder="New task..."
                                        style={{ width: '100%', padding: '0.4rem', border: '1px solid var(--border-dim)', marginBottom: '0.4rem', background: 'rgba(0,0,0,0.1)', color: 'var(--text-main)' }}
                                    />
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <button type="submit" style={{ flex: 1, background: 'var(--accent-gold)', color: 'var(--bg-main)', border: 'none', cursor: 'pointer', fontSize: '0.8rem', padding: '0.2rem', fontWeight: 'bold' }}>Add</button>
                                        <button type="button" onClick={() => setAddingToColumn(null)} style={{ flex: 1, background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border-dim)', cursor: 'pointer', fontSize: '0.8rem', padding: '0.2rem' }}>Cancel</button>
                                    </div>
                                </form>
                            </div>
                        )}

                        {/* Task List */}
                        <div style={{ flex: 1, padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', overflowY: 'auto' }}>
                            {filteredTasks.filter(t => t.status === col.id).map(task => {
                                const proj = projects.find(p => p.id === task.project_id);

                                return (
                                    <div key={task.id} style={{
                                        background: 'var(--bg-panel)',
                                        padding: '0.75rem',
                                        borderRadius: '2px',
                                        boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
                                        borderLeft: `4px solid ${proj ? proj.color : '#999'}`,
                                        border: '1px solid var(--border-dim)', // Main border
                                        borderLeftWidth: '4px', // Override left
                                        position: 'relative'
                                    }}>
                                        {/* Project Tag */}
                                        <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
                                            <span>{proj ? proj.name : 'Unknown Project'}</span>
                                        </div>

                                        {/* Content */}
                                        {editingTask === task.id ? (
                                            <form onSubmit={(e) => handleUpdateTaskTitle(e, task.id)} style={{ marginBottom: '0.5rem' }}>
                                                <input
                                                    name="editTitle"
                                                    defaultValue={task.title}
                                                    autoFocus
                                                    style={{ width: '100%', padding: '0.4rem', border: '1px solid var(--active-border)', background: 'rgba(0,0,0,0.2)', color: 'var(--text-main)' }}
                                                    onBlur={() => setEditingTask(null)} // Save/Cancel on blur
                                                />
                                            </form>
                                        ) : (
                                            <div
                                                onClick={() => setEditingTask(task.id)}
                                                style={{ color: 'var(--text-main)', marginBottom: '0.5rem', cursor: 'text', fontSize: '0.9rem', lineHeight: '1.4' }}
                                                title="Click to edit"
                                            >
                                                {task.title}
                                            </div>
                                        )}

                                        {/* Controls */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dashed var(--border-dim)', paddingTop: '0.5rem' }}>
                                            <button
                                                disabled={col.id === 'backlog'}
                                                onClick={() => handleMoveTask(task.id, -1)}
                                                style={{ cursor: 'pointer', border: 'none', background: 'transparent', opacity: col.id === 'backlog' ? 0.2 : 0.6, color: 'var(--text-main)' }}
                                            >←</button>

                                            <button
                                                onClick={() => handleDeleteTask(task.id)}
                                                style={{
                                                    cursor: 'pointer', border: 'none', background: 'transparent',
                                                    color: deleteConfirm === task.id ? 'var(--accent-crimson)' : 'var(--text-muted)',
                                                    fontWeight: deleteConfirm === task.id ? 'bold' : 'normal',
                                                    opacity: deleteConfirm === task.id ? 1 : 0.5,
                                                    fontSize: '0.8rem'
                                                }}
                                            >
                                                {deleteConfirm === task.id ? 'Confirm?' : '×'}
                                            </button>

                                            <button
                                                disabled={col.id === 'deployed'}
                                                onClick={() => handleMoveTask(task.id, 1)}
                                                style={{ cursor: 'pointer', border: 'none', background: 'transparent', opacity: col.id === 'deployed' ? 0.2 : 0.6, color: 'var(--text-main)' }}
                                            >→</button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default KanbanBoard;
