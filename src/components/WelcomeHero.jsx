import React from 'react';
import { useNavigate } from 'react-router-dom';
import { GiKey, GiSparkles, GiBookCover } from 'react-icons/gi';
import Button from './ui/Button';

/**
 * First-run guide. It used to be 100 lines of inline styles, an
 * `animation: 'fadeIn ...'` for a keyframe that did not exist, and two
 * classes (.welcome-card, .hover-bg-dim) that no stylesheet defined.
 *
 * It also had three doors and two destinations: "Initiate Vibe" and "Link
 * Chronometer" both opened /settings, and "Explore Archives" only dismissed
 * the guide. Both settings errands are one page, so they are now one door,
 * and the second door goes somewhere.
 *
 * Styles live in Dashboard.css, which is the only page that renders this.
 */
const DOORS = [
    {
        icon: <GiKey />,
        title: 'Furnish the Estate',
        copy: 'Choose your aesthetic, arrange the dashboard, link your calendar.',
        to: '/settings',
    },
    {
        icon: <GiBookCover />,
        title: 'Open the Archives',
        copy: 'Log the first book, film or record you have finished.',
        to: '/library',
    },
];

const WelcomeHero = ({ onDismiss }) => {
    const navigate = useNavigate();

    const enter = (to) => {
        onDismiss?.();
        navigate(to);
    };

    return (
        <section className="welcome-hero" aria-labelledby="welcome-hero-title">
            <span className="welcome-hero__mark" aria-hidden="true">
                <GiSparkles />
            </span>

            <h1 id="welcome-hero-title" className="welcome-hero__title">
                Welcome to your Reality, Traveler
            </h1>

            <p className="welcome-hero__lede">
                The Me Portal is a sanctum for your rituals, goals, and archives.
                Your journey begins with a few essential configurations.
            </p>

            <div className="welcome-hero__doors">
                {DOORS.map((door) => (
                    <button
                        key={door.title}
                        type="button"
                        className="welcome-card"
                        onClick={() => enter(door.to)}
                    >
                        <span className="welcome-card__icon">{door.icon}</span>
                        <span className="welcome-card__title">{door.title}</span>
                        <span className="welcome-card__copy">{door.copy}</span>
                    </button>
                ))}
            </div>

            <Button
                icon
                size="sm"
                className="welcome-hero__dismiss"
                onClick={onDismiss}
                label="Dismiss welcome guide"
            >
                ×
            </Button>
        </section>
    );
};

export default WelcomeHero;
