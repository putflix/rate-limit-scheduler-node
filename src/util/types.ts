export interface File {
    created_at: any;
    crc32: string;
    filename: string;
    is_mp4_available: boolean;
    mime: string;
    putio_id: number;
    size: number;
}

export interface Payload {
    account_id: string;
    file: File;
}

export interface Job {
    id: string;
    endpoint: string;
    payload: Payload;
}

export interface ScheduleResponse {
    items: Job[];
}