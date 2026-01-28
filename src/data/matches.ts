import type { Match } from '../types'

export const matches: Match[] = [
    {
        id: 'q1',
        label: 'Qualifier 1',
        red: ['1234', '5678', '9012'],
        blue: ['3456', '7890', '2468'],
        start: new Date('2026-01-10T10:00:00Z').getTime(),
    },
    {
        id: 'q2',
        label: 'Qualifier 2',
        red: ['1357', '2468', '3579'],
        blue: ['1111', '2222', '3333'],
        start: new Date('2026-01-10T10:15:00Z').getTime(),
    },
    {
        id: 'q3',
        label: 'Qualifier 3',
        red: ['4444', '5555', '6666'],
        blue: ['7777', '8888', '9999'],
        start: new Date('2026-01-10T10:30:00Z').getTime(),
    },
]
