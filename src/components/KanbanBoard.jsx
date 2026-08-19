import React, { useState, useEffect } from 'react';
import { GiRoundBottomFlask, GiTestTubes, GiCheckMark, GiFeather, GiTiedScroll, GiTrashCan } from 'react-icons/gi';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Button, Card, Field, ConfirmButton, EmptyState } from './ui';

/* Column accents used to be a hardcoded Material palette (#795548,
   #d84315, #fbc02d, #2e7d32) that stayed brown-and-orange on all seven
   skins. They are now palette variables, so the board recolours with
   the room. */
const COLUMNS = {
    backlog: { id: 'backlog', title: 'Ideas & Backlog', icon: GiFeather, color: 'var(--text-muted)' },
    inprogress: { id: 'inprogress', title: 'In the Workshop', icon: GiRoundBottomFlask, color: 'var(--accent-gold)' },
    review: { id: 'review', title: 'Review', icon: GiTestTubes, color: 'var(--accent-crimson)' },
    deployed: { id: 'deployed', title: 'Deployed', icon: GiCheckMark, color: 'var(--accent-green)' }
};

const COLUMN_KEYS = Object.keys(COLUMNS);

/* Project spine colours. Stored verbatim in `projects.color`; rows
   written before this change still hold hex literals and keep working,
   because an inline style accepts either. */
const PROJECT_COLORS = [
    'var(--accent-gold)',
    'var(--accent-green)',
    'var(--accent-crimson)',
    'var(--accent-red)',
    'var(--text-highlight)',
    'var(--border-gold)'
];

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

    // Load Filter Preference
    useEffect(() => {
        if (user) {
            const saved = localStorage.getItem(`me_portal_kanban_filter_${user.id}`);
            if (saved) setSelectedProjectFilter(saved);
        }
    }, [user]);

    // NOTE: intentionally not keyed on `user`. `projects` / `project_tasks`
    // carry no user_id column yet (see the audit's schema item), so the query
    // is identical for every session and adding the dependency would only
    // refetch the same rows each time auth state settles. Revisit when those
    // tables get a user_id and the select starts filtering on it.
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
        const randomColor = PROJECT_COLORS[Math.floor(Math.random() * PROJECT_COLORS.length)];

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
        const { error } = await supabase.from('projects').delete().eq('id', pid);
        if (error) {
            console.error(error);
            alert('Failed to delete project');
        } else {
            setProjects(prev => prev.filter(p => p.id !== pid));
            setTasks(prev => prev.filter(t => t.project_id !== pid));
            if (selectedProjectFilter === pid) setSelectedProjectFilter('All');
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

        const idx = COLUMN_KEYS.indexOf(task.status);
        const newIdx = idx + direction;

        if (newIdx >= 0 && newIdx < COLUMN_KEYS.length) {
            const newStatus = COLUMN_KEYS[newIdx];

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
        // Optimistic
        setTasks(prev => prev.filter(t => t.id !== taskId));

        const { error } = await supabase.from('project_tasks').delete().eq('id', taskId);
        if (error) {
            console.error(error);
            // Actually hard to revert a delete easily without refetching or keeping copy.
            // Just alert user.
            alert('Failed to delete task');
            fetchData(); // Sync back
        }
    };

    // Filter Logic
    const filteredTasks = selectedProjectFilter === 'All'
        ? tasks
        : tasks.filter(t => t.project_id === selectedProjectFilter);

    const activeProject = projects.find(p => p.id === selectedProjectFilter);

    return (
        <div className="stack">

            {/* --- Control Deck --- */}
            <Card variant="flat">
                <div className="row row--wrap" style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    {/* Project Filter */}
                    <div className="row row--wrap" style={{ alignItems: 'flex-end' }}>
                        <Field label="Active Project">
                            <select
                                className="select"
                                value={selectedProjectFilter}
                                onChange={(e) => setSelectedProjectFilter(e.target.value)}
                            >
                                <option value="All">All Projects</option>
                                {projects.map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                        </Field>
                        {activeProject && (
                            <ConfirmButton
                                label="Dissolve Project"
                                confirmLabel="Confirm Dissolve?"
                                onConfirm={() => handleDeleteProject(activeProject.id)}
                            >
                                Dissolve Project
                            </ConfirmButton>
                        )}
                    </div>

                    {/* Add New Project */}
                    <form onSubmit={handleAddProject} className="row" style={{ alignItems: 'flex-end' }}>
                        <Field
                            label="New Project"
                            value={newProjectName}
                            onChange={(e) => setNewProjectName(e.target.value)}
                            placeholder="Name the undertaking..."
                        />
                        <Button type="submit" variant="primary">
                            <GiTiedScroll /> Create
                        </Button>
                    </form>
                </div>
            </Card>

            {/* --- The Board --- */}
            {loading ? (
                <p className="muted">Opening the ledger...</p>
            ) : projects.length === 0 ? (
                <EmptyState
                    icon={<GiTiedScroll />}
                    message="No undertakings on the ledger."
                    hint="Name one above and the board will draw itself."
                />
            ) : (
                /* Four fixed 1fr columns used to squeeze to ~85px each on a
                   phone under `overflow: hidden`. Columns now hold a floor of
                   15rem and the board scrolls sideways instead. */
                <div
                    style={{
                        display: 'grid',
                        gridAutoFlow: 'column',
                        gridAutoColumns: 'minmax(15rem, 1fr)',
                        gap: 'var(--space-4)',
                        overflowX: 'auto',
                        alignItems: 'start',
                        paddingBottom: 'var(--space-2)'
                    }}
                >
                    {Object.values(COLUMNS).map((col, colIndex) => {
                        const columnTasks = filteredTasks.filter(t => t.status === col.id);

                        return (
                            <Card
                                key={col.id}
                                variant="flat"
                                scroll
                                icon={<col.icon color={col.color} />}
                                title={col.title}
                                actions={
                                    <Button
                                        icon
                                        size="sm"
                                        label={`Add task to ${col.title}`}
                                        onClick={() => setAddingToColumn(col.id)}
                                    >
                                        +
                                    </Button>
                                }
                            >
                                <div className="stack">
                                    {/* Quick Add Form */}
                                    {addingToColumn === col.id && (
                                        <form onSubmit={(e) => handleSaveNewTask(e, col.id)} className="stack">
                                            <Field
                                                label={`New task in ${col.title}`}
                                                name="taskTitle"
                                                autoFocus
                                                placeholder="New task..."
                                            />
                                            <div className="row">
                                                <Button type="submit" variant="primary" size="sm">Add</Button>
                                                <Button size="sm" onClick={() => setAddingToColumn(null)}>Cancel</Button>
                                            </div>
                                        </form>
                                    )}

                                    {columnTasks.length === 0 && addingToColumn !== col.id && (
                                        <p className="muted">Nothing filed here.</p>
                                    )}

                                    {columnTasks.map(task => {
                                        const proj = projects.find(p => p.id === task.project_id);
                                        const spine = proj?.color || 'var(--border-dim)';

                                        return (
                                            <Card
                                                key={task.id}
                                                variant="flat"
                                                style={{ borderLeft: `4px solid ${spine}` }}
                                            >
                                                {/* Project Tag */}
                                                <p className="muted" style={{ margin: 0, fontSize: 'var(--text-2xs)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-label)' }}>
                                                    {proj ? proj.name : 'Unknown Project'}
                                                </p>

                                                {/* Content */}
                                                {editingTask === task.id ? (
                                                    <form onSubmit={(e) => handleUpdateTaskTitle(e, task.id)}>
                                                        <Field
                                                            label={`Rename "${task.title}"`}
                                                            name="editTitle"
                                                            defaultValue={task.title}
                                                            autoFocus
                                                            onBlur={() => setEditingTask(null)} // Save/Cancel on blur
                                                        />
                                                    </form>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => setEditingTask(task.id)}
                                                        title="Click to edit"
                                                        style={{
                                                            display: 'block',
                                                            width: '100%',
                                                            textAlign: 'left',
                                                            font: 'inherit',
                                                            color: 'var(--text-main)',
                                                            fontSize: 'var(--text-sm)',
                                                            lineHeight: 'var(--leading-snug)',
                                                            cursor: 'text'
                                                        }}
                                                    >
                                                        {task.title}
                                                    </button>
                                                )}

                                                {/* Controls */}
                                                <div className="row" style={{ justifyContent: 'space-between', borderTop: 'var(--rule-hair)', paddingTop: 'var(--space-2)' }}>
                                                    <Button
                                                        icon
                                                        size="sm"
                                                        disabled={colIndex === 0}
                                                        onClick={() => handleMoveTask(task.id, -1)}
                                                        label={colIndex === 0
                                                            ? `"${task.title}" is already in the first column`
                                                            : `Move "${task.title}" to ${COLUMNS[COLUMN_KEYS[colIndex - 1]].title}`}
                                                    >
                                                        &larr;
                                                    </Button>

                                                    <ConfirmButton
                                                        icon={<GiTrashCan />}
                                                        label={`Delete task "${task.title}"`}
                                                        confirmLabel="Confirm?"
                                                        onConfirm={() => handleDeleteTask(task.id)}
                                                    />

                                                    <Button
                                                        icon
                                                        size="sm"
                                                        disabled={colIndex === COLUMN_KEYS.length - 1}
                                                        onClick={() => handleMoveTask(task.id, 1)}
                                                        label={colIndex === COLUMN_KEYS.length - 1
                                                            ? `"${task.title}" is already in the last column`
                                                            : `Move "${task.title}" to ${COLUMNS[COLUMN_KEYS[colIndex + 1]].title}`}
                                                    >
                                                        &rarr;
                                                    </Button>
                                                </div>
                                            </Card>
                                        );
                                    })}
                                </div>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default KanbanBoard;
