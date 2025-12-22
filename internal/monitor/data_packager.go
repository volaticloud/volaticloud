package monitor

import (
	"archive/zip"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
)

// MaxDecompressedSize is the maximum allowed size for decompressed data (1GB).
// This prevents decompression bomb attacks (zip bombs).
const MaxDecompressedSize = 1 << 30 // 1GB

// PackData creates a zip archive from a directory.
// The directory structure is preserved in the archive.
func PackData(dataDir string, writer io.Writer) error {
	zipWriter := zip.NewWriter(writer)
	defer zipWriter.Close()

	// Walk through all files in the directory
	err := filepath.Walk(dataDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		// Skip the root directory itself
		if path == dataDir {
			return nil
		}

		// Get relative path
		relPath, err := filepath.Rel(dataDir, path)
		if err != nil {
			return fmt.Errorf("failed to get relative path: %w", err)
		}

		// Use forward slashes for zip compatibility
		relPath = strings.ReplaceAll(relPath, string(os.PathSeparator), "/")

		// Create zip header
		header, err := zip.FileInfoHeader(info)
		if err != nil {
			return fmt.Errorf("failed to create zip header: %w", err)
		}
		header.Name = relPath

		if info.IsDir() {
			header.Name += "/"
			_, err := zipWriter.CreateHeader(header)
			return err
		}

		// Set compression method
		header.Method = zip.Deflate

		// Create entry in zip
		writer, err := zipWriter.CreateHeader(header)
		if err != nil {
			return fmt.Errorf("failed to create zip entry: %w", err)
		}

		// Copy file content
		// #nosec G304 -- path comes from filepath.Walk on controlled dataDir
		file, err := os.Open(path)
		if err != nil {
			return fmt.Errorf("failed to open file: %w", err)
		}
		defer file.Close()

		_, err = io.Copy(writer, file)
		if err != nil {
			return fmt.Errorf("failed to copy file content: %w", err)
		}

		return nil
	})

	if err != nil {
		return fmt.Errorf("failed to walk directory: %w", err)
	}

	return nil
}

// UnpackData extracts a zip archive to a destination directory.
func UnpackData(reader io.ReaderAt, size int64, destDir string) error {
	zipReader, err := zip.NewReader(reader, size)
	if err != nil {
		return fmt.Errorf("failed to create zip reader: %w", err)
	}

	for _, file := range zipReader.File {
		// Construct destination path
		// #nosec G305 -- path traversal check is performed below
		destPath := filepath.Join(destDir, file.Name)

		// Prevent path traversal attacks (zip slip)
		if !strings.HasPrefix(destPath, filepath.Clean(destDir)+string(os.PathSeparator)) {
			return fmt.Errorf("invalid file path: %s", file.Name)
		}

		if file.FileInfo().IsDir() {
			if err := os.MkdirAll(destPath, 0750); err != nil {
				return fmt.Errorf("failed to create directory: %w", err)
			}
			continue
		}

		// Ensure parent directory exists
		if err := os.MkdirAll(filepath.Dir(destPath), 0750); err != nil {
			return fmt.Errorf("failed to create parent directory: %w", err)
		}

		// Extract file
		if err := extractFile(file, destPath); err != nil {
			return err
		}
	}

	return nil
}

func extractFile(file *zip.File, destPath string) error {
	src, err := file.Open()
	if err != nil {
		return fmt.Errorf("failed to open zip entry: %w", err)
	}
	defer src.Close()

	// #nosec G304 -- destPath is validated for path traversal in UnpackData
	dst, err := os.OpenFile(destPath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, file.Mode())
	if err != nil {
		return fmt.Errorf("failed to create destination file: %w", err)
	}
	defer dst.Close()

	// Limit decompressed size to prevent decompression bomb attacks
	limitedReader := io.LimitReader(src, MaxDecompressedSize)
	written, err := io.Copy(dst, limitedReader)
	if err != nil {
		return fmt.Errorf("failed to extract file: %w", err)
	}

	// Check if we hit the size limit (potential decompression bomb)
	if written == MaxDecompressedSize {
		return fmt.Errorf("file %s exceeds maximum decompressed size (%d bytes)", file.Name, MaxDecompressedSize)
	}

	return nil
}

// GetDataDirSize returns the total size of all files in a directory (for progress tracking).
func GetDataDirSize(dataDir string) (int64, error) {
	var size int64
	err := filepath.Walk(dataDir, func(_ string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if !info.IsDir() {
			size += info.Size()
		}
		return nil
	})
	return size, err
}
