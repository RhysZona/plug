import React, { useRef, memo } from 'react';

interface FileUploadProps {
    onFileUpload: (file: File) => void;
    accept?: string;
    children: React.ReactNode;
    id?: string;
    disabled?: boolean;
}

export const FileUpload: React.FC<FileUploadProps> = memo(({ onFileUpload, accept, children, id = 'file-upload', disabled = false }) => {
    const inputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files[0]) {
            onFileUpload(event.target.files[0]);
             // Reset input value to allow re-uploading the same file
            event.target.value = '';
        }
    };
    
    const handleClick = (e: React.MouseEvent) => {
        if (disabled) {
            e.preventDefault();
        }
    };

    return (
        <div className={disabled ? 'opacity-50' : ''}>
            <input
                type="file"
                ref={inputRef}
                onChange={handleFileChange}
                accept={accept}
                className="hidden"
                id={id}
                disabled={disabled}
            />
            <label htmlFor={id} className={!disabled ? 'cursor-pointer' : 'cursor-not-allowed'} onClick={handleClick}>
                {children}
            </label>
        </div>
    );
});