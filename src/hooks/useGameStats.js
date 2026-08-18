import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

export const useGameStats = () => {
    const { user } = useAuth();
    const [stats, setStats] = useState({});
    const [storageKey, setStorageKey] = useState(null);

    // Load stats from local storage on mount or user change
    useEffect(() => {
        if (user) {
            const key = `me_portal_game_stats_${user.id}`;
            setStorageKey(key);
            const stored = localStorage.getItem(key);
            if (stored) {
                try {
                    setStats(JSON.parse(stored));
                } catch (e) {
                    console.error("Error parsing game stats", e);
                    setStats({});
                }
            } else {
                setStats({});
            }
        } else {
            setStorageKey(null);
            setStats({});
        }
    }, [user]);

    // Helper to get today's date string YYYY-MM-DD
    const getToday = () => {
        return new Date().toISOString().split('T')[0];
    };

    const logGame = (gameId, result) => {
        if (!storageKey) return;

        const today = getToday();
        const newStats = { ...stats };

        if (!newStats[gameId]) {
            newStats[gameId] = {};
        }

        newStats[gameId][today] = {
            played: true,
            result: result,
            timestamp: Date.now()
        };

        setStats(newStats);
        localStorage.setItem(storageKey, JSON.stringify(newStats));
    };

    const isPlayedToday = (gameId) => {
        const today = getToday();
        return stats[gameId]?.[today]?.played || false;
    };

    const getStreak = (gameId) => {
        // Simple streak calculation
        if (!stats[gameId]) return 0;

        let streak = 0;
        const today = new Date();
        // Check back up to 365 days
        for (let i = 0; i < 365; i++) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];

            if (stats[gameId][dateStr]?.played) {
                streak++;
            } else if (i === 0 && !stats[gameId][dateStr]?.played) {
                // If today isn't played yet, don't break streak, just continue to check yesterday
                continue;
            } else {
                break;
            }
        }
        return streak;
    };

    return {
        stats,
        logGame,
        isPlayedToday,
        getStreak
    };
};
