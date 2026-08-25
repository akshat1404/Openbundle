import { useRef, useState, type ChangeEvent } from "react";
import type { SampleFile } from "./sampleProject.js";

interface FileUploadProps {
  onFilesSelected: (files: SampleFile[]) => void;
}

/**
 * Upload control only. Reads selected files into memory as text;
 * does not parse or resolve anything — that starts in stage 2.
 */
export function FileUpload({ onFilesSelected }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploadedNames, setUploadedNames] = useState<string[]>([]);

  async function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const fileList = event.target.files;
    if (!fileList || fileList.length === 0) return;

    const files: SampleFile[] = await Promise.all(
      Array.from(fileList).map(async (file) => ({
        path: (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name,
        contents: await file.text(),
      })),
    );

    setUploadedNames(files.map((f) => f.path));
    onFilesSelected(files);
  }

  return (
    <div className="file-upload">
      <input
        ref={inputRef}
        type="file"
        multiple
        // @ts-expect-error non-standard attributes for folder upload
        webkitdirectory=""
        directory=""
        onChange={handleChange}
      />
      {uploadedNames.length > 0 && (
        <ul className="file-upload__list">
          {uploadedNames.map((name) => (
            <li key={name}>{name}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
