import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import Upload from 'lucide-react/dist/esm/icons/upload';
import FileIcon from 'lucide-react/dist/esm/icons/file';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';

interface FileDropZoneProps {
    onFilesSelected: (files: File[]) => void;
    disabled?: boolean;
    recipientName?: string;
    className?: string;
}

export default function FileDropZone({
    onFilesSelected,
    disabled = false,
    recipientName,
    className,
}: FileDropZoneProps) {
    const onDrop = useCallback(
        (acceptedFiles: File[]) => {
            if (!disabled && acceptedFiles.length > 0) {
                onFilesSelected(acceptedFiles);
            }
        },
        [disabled, onFilesSelected]
    );

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        noClick: disabled,
        disabled,
    });

    return (
        <Card
            {...getRootProps()}
            className={cn(
                'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all duration-200',
                isDragActive
                    ? 'border-primary bg-primary/5 scale-[0.98]'
                    : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50',
                disabled && 'opacity-50 cursor-not-allowed hover:border-muted-foreground/25 hover:bg-transparent',
                className
            )}
        >
            <input {...getInputProps()} />

            <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                    {isDragActive ? (
                        <Upload className="w-8 h-8 text-primary animate-bounce" />
                    ) : (
                        <FileIcon className="w-8 h-8 text-primary" />
                    )}
                </div>

                {disabled ? (
                    <div>
                        <p className="text-sm font-medium text-muted-foreground">
                            Select a chat to share files
                        </p>
                    </div>
                ) : (
                    <div>
                        <p className="text-base font-semibold">
                            {isDragActive ? 'Drop files here' : 'Drag & drop files'}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                            {recipientName ? `to send to ${recipientName}` : 'or click to browse'}
                        </p>
                    </div>
                )}
            </div>
        </Card>
    );
}
