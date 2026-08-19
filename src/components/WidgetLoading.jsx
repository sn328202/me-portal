import React from 'react';
import { GiHourglass } from 'react-icons/gi';

/**
 * Widget-sized loading placeholder. Previously injected its own `@keyframes`
 * into the document on every render and hardcoded `#8d6e63` — a colour from
 * one theme's palette, burned into all seven.
 */
const WidgetLoading = () => (
    <div className="empty empty--inline">
        <span className="empty__icon spin">
            <GiHourglass />
        </span>
        <span className="visually-hidden">Loading</span>
    </div>
);

export default WidgetLoading;
