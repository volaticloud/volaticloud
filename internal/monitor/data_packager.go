package monitor

import (
	"archive/tar"
	"compress/gzip"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
)

// MaxDecompressedSize is the maximum allowed size for decompressed data (1GB).
// This prevents decompression bomb attacks.
const MaxDecompressedSize = 1 << 30 // 1GB

// PackData creates a tar.gz archive from a directory.
// The directory structure is preserved in the archive.
func PackData(dataDir string, writer io.Writer) error {
	gzWriter := gzip.NewWriter(writer)
	defer gzWriter.Close()

	tarWriter := tar.NewWriter(gzWriter)
	defer tarWriter.Close()

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

		// Use forward slashes for cross-platform compatibility
		relPath = strings.ReplaceAll(relPath, string(os.PathSeparator), "/")

		// Create tar header
		header, err := tar.FileInfoHeader(info, "")
		if err != nil {
			return fmt.Errorf("failed to create tar header: %w", err)
		}
		header.Name = relPath

		// Write header
		if err := tarWriter.WriteHeader(header); err != nil {
			return fmt.Errorf("failed to write tar header: %w", err)
		}

		// If it's a directory, we're done
		if info.IsDir() {
			return nil
		}

		// Copy file content
		// #nosec G304 -- path comes from filepath.Walk on controlled dataDir
		file, err := os.Open(path)
		if err != nil {
			return fmt.Errorf("failed to open file: %w", err)
		}
		defer file.Close()

		_, err = io.Copy(tarWriter, file)
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

// UnpackData extracts a tar.gz archive to a destination directory.
func UnpackData(reader io.Reader, destDir string) error {
	gzReader, err := gzip.NewReader(reader)
	if err != nil {
		return fmt.Errorf("failed to create gzip reader: %w", err)
	}
	defer gzReader.Close()

	tarReader := tar.NewReader(gzReader)

	var totalSize int64
	for {
		header, err := tarReader.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return fmt.Errorf("failed to read tar entry: %w", err)
		}

		// Construct destination path
		// #nosec G305 -- path traversal check is performed below
		destPath := filepath.Join(destDir, header.Name)

		// Prevent path traversal attacks (tar slip)
		if !strings.HasPrefix(filepath.Clean(destPath), filepath.Clean(destDir)+string(os.PathSeparator)) {
			return fmt.Errorf("invalid file path: %s", header.Name)
		}

		switch header.Typeflag {
		case tar.TypeDir:
			if err := os.MkdirAll(destPath, 0750); err != nil {
				return fmt.Errorf("failed to create directory: %w", err)
			}

		case tar.TypeReg:
			// Ensure parent directory exists
			if err := os.MkdirAll(filepath.Dir(destPath), 0750); err != nil {
				return fmt.Errorf("failed to create parent directory: %w", err)
			}

			// Extract file with size limit
			if err := extractTarFile(tarReader, destPath, header, &totalSize); err != nil {
				return err
			}
		}
	}

	return nil
}

func extractTarFile(reader *tar.Reader, destPath string, header *tar.Header, totalSize *int64) error {
	// Check cumulative size to prevent decompression bombs
	*totalSize += header.Size
	if *totalSize > MaxDecompressedSize {
		return fmt.Errorf("archive exceeds maximum decompressed size (%d bytes)", MaxDecompressedSize)
	}

	// Safely convert header.Mode to os.FileMode
	// Use bitwise AND to extract only valid permission bits (0777 = rwxrwxrwx)
	// This prevents integer overflow when converting int64 to uint32
	// #nosec G115 -- Mode is safely masked to valid permission bits
	fileMode := os.FileMode(header.Mode & 0777)

	// #nosec G304 -- destPath is validated for path traversal in UnpackData
	dst, err := os.OpenFile(destPath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, fileMode)
	if err != nil {
		return fmt.Errorf("failed to create destination file: %w", err)
	}
	defer dst.Close()

	// Copy with size limit
	limitedReader := io.LimitReader(reader, header.Size)
	written, err := io.Copy(dst, limitedReader)
	if err != nil {
		return fmt.Errorf("failed to extract file: %w", err)
	}

	if written != header.Size {
		return fmt.Errorf("file size mismatch: expected %d, got %d", header.Size, written)
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
