// Date Utilities for Calendar View
export const DateUtils = {
    // Get Monday of the week containing the given date
    getMonday(date) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
        d.setDate(diff);
        d.setHours(0, 0, 0, 0);
        return d;
    },

    // Format date as "Montag, 23.12.2024"
    formatDateWithDay(date) {
        const days = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
        const d = new Date(date);
        const dayName = days[d.getDay()];
        const day = d.getDate().toString().padStart(2, '0');
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        const year = d.getFullYear();
        return `${dayName}, ${day}.${month}.${year}`;
    },

    // Format week range as "23.12. - 29.12.2024"
    formatWeekRange(startDate) {
        const start = new Date(startDate);
        const end = new Date(start);
        end.setDate(start.getDate() + 6);

        const startDay = start.getDate().toString().padStart(2, '0');
        const startMonth = (start.getMonth() + 1).toString().padStart(2, '0');
        const endDay = end.getDate().toString().padStart(2, '0');
        const endMonth = (end.getMonth() + 1).toString().padStart(2, '0');
        const year = end.getFullYear();

        if (start.getMonth() === end.getMonth()) {
            return `${startDay}. - ${endDay}.${endMonth}.${year}`;
        }
        return `${startDay}.${startMonth}. - ${endDay}.${endMonth}.${year}`;
    },

    // Get week ID from date (format: YYYY-WW)
    getWeekId(date) {
        const d = new Date(date);
        const monday = this.getMonday(d);
        const year = monday.getFullYear();
        const firstDayOfYear = new Date(year, 0, 1);
        const firstMonday = this.getMonday(firstDayOfYear);
        if (firstMonday > firstDayOfYear) {
            firstMonday.setDate(firstMonday.getDate() - 7);
        }
        const weekNumber = Math.ceil(((monday - firstMonday) / 86400000 + 1) / 7);
        return `${year}-W${weekNumber.toString().padStart(2, '0')}`;
    },

    // Check if date is today
    isToday(date) {
        const today = new Date();
        const d = new Date(date);
        return d.getDate() === today.getDate() &&
               d.getMonth() === today.getMonth() &&
               d.getFullYear() === today.getFullYear();
    },

    // Check if date is in the past
    isPast(date) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        return d < today;
    }
};
