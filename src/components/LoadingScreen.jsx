import React from 'react';
import { GiHourglass } from 'react-icons/gi';

const LoadingScreen = () => {
    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100vh',
            width: '100vw',
            background: '#1a1a1a', // Dark background
            color: '#c5a059', // Gold color
            position: 'fixed',
            top: 0,
            left: 0,
            zIndex: 9999
        }}>
            <style>
                {`
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        50% { transform: rotate(180deg); }
                        100% { transform: rotate(360deg); }
                    }
                    @keyframes pulse {
                        0% { opacity: 0.5; }
                        50% { opacity: 1; }
                        100% { opacity: 0.5; }
                    }
                `}
            </style>
            <div style={{
                animation: 'spin 3s infinite ease-in-out',
                fontSize: '4rem',
                marginBottom: '1rem',
                filter: 'drop-shadow(0 0 10px rgba(197, 160, 89, 0.3))'
            }}>
                <GiHourglass />
            </div>
            <div style={{
                fontFamily: '"Playfair Display", serif',
                fontSize: '1.2rem',
                letterSpacing: '2px',
                textTransform: 'uppercase',
                animation: 'pulse 2s infinite ease-in-out',
                marginTop: '1rem'
            }}>
                Accessing Archive...
            </div>
        </div>
    );
};

export default LoadingScreen;
