import React from 'react';
import { GiHourglass } from 'react-icons/gi';

const WidgetLoading = () => {
    return (
        <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100%',
            minHeight: '150px',
            color: '#8d6e63',
            opacity: 0.7
        }}>
            <style>
                {`
                    @keyframes spin-slow {
                        0% { transform: rotate(0deg); }
                        50% { transform: rotate(180deg); }
                        100% { transform: rotate(360deg); }
                    }
                `}
            </style>
            <div style={{
                animation: 'spin-slow 3s infinite ease-in-out',
                fontSize: '2rem'
            }}>
                <GiHourglass />
            </div>
        </div>
    );
};

export default WidgetLoading;
