import os
from PIL import Image

def compress_images(root_dir, scale_factor=0.8, jpeg_quality=95):
    supported_formats = ('.png', '.jpg', '.jpeg', '.webp')
    count = 0
    total_saved_bytes = 0
    
    for subdir, _, files in os.walk(root_dir):
        # We target images inside 'images' folders within the exams directory
        if 'images' in subdir:
            for file in files:
                if file.lower().endswith(supported_formats):
                    file_path = os.path.join(subdir, file)
                    try:
                        original_size = os.path.getsize(file_path)
                        with Image.open(file_path) as img:
                            # Calculate new dimensions (80% of current)
                            width, height = img.size
                            new_size = (int(width * scale_factor), int(height * scale_factor))
                            
                            # Resize with high-quality LANCZOS filter
                            img = img.resize(new_size, Image.Resampling.LANCZOS)
                            
                            # Save with high-quality optimization
                            if file.lower().endswith('.png'):
                                # PNG uses lossless optimization
                                img.save(file_path, optimize=True)
                            elif file.lower().endswith('.webp'):
                                # WebP can be used with high quality
                                img.save(file_path, quality=jpeg_quality, method=6)
                            else:
                                # JPEG/JPG near-lossless
                                img.save(file_path, quality=jpeg_quality, optimize=True)
                        
                        new_size_bytes = os.path.getsize(file_path)
                        saved = original_size - new_size_bytes
                        
                        if saved > 0:
                            print(f"Resized & Optimized ({saved/1024:.1f} KB saved): {file_path}")
                            total_saved_bytes += saved
                        else:
                            print(f"Processed (Dimensions reduced, but no size benefit): {file_path}")
                            
                        count += 1
                    except Exception as e:
                        print(f"Error processing {file_path}: {e}")
    
    print(f"\nSummary:")
    print(f"Total images processed: {count}")
    print(f"Total space saved in this pass: {total_saved_bytes / (1024*1024):.2f} MB")

if __name__ == "__main__":
    # Target the 'exams' directory in the root
    exams_dir = os.path.join(os.getcwd(), 'exams')
    if os.path.exists(exams_dir):
        print("Starting 80% scaling and optimization...")
        compress_images(exams_dir, scale_factor=0.8)
    else:
        print(f"Exams directory not found at {exams_dir}")
