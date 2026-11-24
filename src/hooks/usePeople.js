import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { lastTouchByPerson } from '../utils/people';
import { todayLocal } from '../utils/today';

/**
 * The Circle: people, when she last saw them, gift ideas, how they're
 * related to each other, and the groups they belong to.
 *
 * Six small tables loaded together. The whole circle is a few hundred rows
 * at most, so the page holds all of it and filters in memory; nothing here
 * pages or searches on the server.
 */
export const usePeople = () => {
    const { user } = useAuth();
    const [people, setPeople] = useState([]);
    const [touches, setTouches] = useState([]);
    const [gifts, setGifts] = useState([]);
    const [links, setLinks] = useState([]);
    const [groups, setGroups] = useState([]);
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const load = useCallback(async () => {
        if (!user) {
            setLoading(false);
            return;
        }
        try {
            const mine = (table, order) => supabase.from(table).select('*').eq('user_id', user.id).order(order);
            const [p, t, g, l, gr, m] = await Promise.all([
                mine('people', 'name'),
                mine('person_touchpoints', 'happened_on'),
                mine('person_gift_ideas', 'created_at'),
                mine('person_links', 'created_at'),
                mine('people_groups', 'name'),
                supabase.from('people_group_members').select('*').eq('user_id', user.id),
            ]);
            const failedOne = [p, t, g, l, gr, m].find((r) => r.error);
            if (failedOne) throw failedOne.error;
            setPeople(p.data || []);
            setTouches(t.data || []);
            setGifts(g.data || []);
            setLinks(l.data || []);
            setGroups(gr.data || []);
            setMembers(m.data || []);
            setError(null);
        } catch (err) {
            setError(err.message || 'Could not load your people');
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => { load(); }, [load]);

    /** Insert, put the row in local state, hand it back. */
    const insert = async (table, row, setter, { prepend = false } = {}) => {
        if (!user) throw new Error('Not authenticated');
        const { data, error: err } = await supabase
            .from(table).insert([{ ...row, user_id: user.id }]).select().single();
        if (err) throw err;
        setter((prev) => (prepend ? [data, ...prev] : [...prev, data]));
        return data;
    };

    /** Change locally first; reload if the database said no. */
    const patch = async (table, id, changes, setter) => {
        if (!user) return;
        setter((prev) => prev.map((r) => (r.id === id ? { ...r, ...changes } : r)));
        const { error: err } = await supabase
            .from(table).update(changes).eq('id', id).eq('user_id', user.id);
        if (err) {
            setError(err.message);
            load();
        }
    };

    const remove = async (table, id, setter) => {
        if (!user) return;
        setter((prev) => prev.filter((r) => r.id !== id));
        const { error: err } = await supabase.from(table).delete().eq('id', id).eq('user_id', user.id);
        if (err) {
            setError(err.message);
            load();
        }
    };

    /* ---------- people ---------- */
    const addPerson = async (row) => {
        const data = await insert('people', row, setPeople);
        setPeople((prev) => [...prev].sort((a, b) => a.name.localeCompare(b.name)));
        return data;
    };
    const updatePerson = (id, changes) => patch('people', id, changes, setPeople);
    const deletePerson = async (id) => {
        // Children go with the row in the database (on delete cascade); drop
        // them here too so nothing on the page points at a ghost.
        setTouches((prev) => prev.filter((t) => t.person_id !== id));
        setGifts((prev) => prev.filter((g) => g.person_id !== id));
        setLinks((prev) => prev.filter((l) => l.person_a !== id && l.person_b !== id));
        setMembers((prev) => prev.filter((m) => m.person_id !== id));
        await remove('people', id, setPeople);
    };

    /* ---------- in touch ---------- */
    const logTouch = (personId, { kind = 'in_person', happened_on, note } = {}) => insert(
        'person_touchpoints',
        { person_id: personId, kind, happened_on: happened_on || todayLocal(), note: note || null },
        setTouches,
    );
    const deleteTouch = (id) => remove('person_touchpoints', id, setTouches);

    /* ---------- gift ideas ---------- */
    const addGift = (personId, { idea, link, occasion }) => insert(
        'person_gift_ideas',
        { person_id: personId, idea, link: link || null, occasion: occasion || null },
        setGifts,
    );
    const updateGift = (id, changes) => patch('person_gift_ideas', id, changes, setGifts);
    const deleteGift = (id) => remove('person_gift_ideas', id, setGifts);

    /* ---------- relationships ---------- */
    const addLink = (personA, personB, label, reverseLabel) => insert(
        'person_links',
        { person_a: personA, person_b: personB, label, reverse_label: reverseLabel || null },
        setLinks,
    );
    const deleteLink = (id) => remove('person_links', id, setLinks);

    /* ---------- groups ---------- */
    const addGroup = async ({ name, emoji, notes }) => {
        const data = await insert('people_groups', { name, emoji: emoji || null, notes: notes || null }, setGroups);
        setGroups((prev) => [...prev].sort((a, b) => a.name.localeCompare(b.name)));
        return data;
    };
    const updateGroup = (id, changes) => patch('people_groups', id, changes, setGroups);
    const deleteGroup = async (id) => {
        setMembers((prev) => prev.filter((m) => m.group_id !== id));
        await remove('people_groups', id, setGroups);
    };
    const toggleMember = async (groupId, personId) => {
        if (!user) return;
        const isIn = members.some((m) => m.group_id === groupId && m.person_id === personId);
        if (isIn) {
            setMembers((prev) => prev.filter((m) => !(m.group_id === groupId && m.person_id === personId)));
            const { error: err } = await supabase.from('people_group_members').delete()
                .eq('group_id', groupId).eq('person_id', personId).eq('user_id', user.id);
            if (err) { setError(err.message); load(); }
        } else {
            const row = { group_id: groupId, person_id: personId, user_id: user.id };
            setMembers((prev) => [...prev, row]);
            const { error: err } = await supabase.from('people_group_members').insert([row]);
            if (err) { setError(err.message); load(); }
        }
    };

    const peopleById = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
    const lastBy = useMemo(() => lastTouchByPerson(touches), [touches]);
    const groupsOf = useMemo(() => {
        const byId = new Map(groups.map((g) => [g.id, g]));
        const out = new Map();
        members.forEach((m) => {
            const g = byId.get(m.group_id);
            if (!g) return;
            if (!out.has(m.person_id)) out.set(m.person_id, []);
            out.get(m.person_id).push(g);
        });
        return out;
    }, [groups, members]);

    return {
        people, touches, gifts, links, groups, members,
        peopleById, lastBy, groupsOf,
        loading, error, refresh: load,
        addPerson, updatePerson, deletePerson,
        logTouch, deleteTouch,
        addGift, updateGift, deleteGift,
        addLink, deleteLink,
        addGroup, updateGroup, deleteGroup, toggleMember,
    };
};
