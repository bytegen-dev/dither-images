/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-empty-object-type */

"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Upload,
  Image as ImageIcon,
  Crop,
  RefreshCcw,
  Copy,
  ChevronDown,
  FileIcon,
  Code,
  Check,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import Shuffle from "./Shuffle";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import Cropper from "react-easy-crop";
import Editor from "@monaco-editor/react";
import TargetCursor from "./TargetCursor";

const minGridSize = 64;
const defaultGridSize = 200;
const maxGridSize = 400;

export default function DitherImageApp() {
  const [image, setImage] = useState<string | null>(null);
  const [gridSize, setGridSize] = useState<number>(defaultGridSize);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCropDialog, setShowCropDialog] = useState(false);
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [showSvgCodeDialog, setShowSvgCodeDialog] = useState(false);
  const [svgCode, setSvgCode] = useState("");
  const [isCopied, setIsCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const cropCanvasRef = useRef<HTMLCanvasElement>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Handle file upload
  const handleFileUpload = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const imageData = e.target?.result as string;
      setOriginalImage(imageData);
      setShowCropDialog(true);
    };
    reader.readAsDataURL(file);
  }, []);

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);

      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        handleFileUpload(files[0]);
      }
    },
    [handleFileUpload]
  );

  // File input handler
  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        handleFileUpload(files[0]);
      }
    },
    [handleFileUpload]
  );

  // Crop dialog handlers
  const onCropComplete = useCallback(
    (croppedArea: any, croppedAreaPixels: any) => {
      setCroppedAreaPixels(croppedAreaPixels);
    },
    []
  );

  const handleCropConfirm = useCallback(async () => {
    if (!originalImage || !croppedAreaPixels) return;

    try {
      const croppedImage = await getCroppedImg(
        originalImage,
        croppedAreaPixels
      );
      setImage(croppedImage);
      setShowCropDialog(false);
      setOriginalImage(null);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
    } catch (error) {
      console.error("Error cropping image:", error);
    }
  }, [originalImage, croppedAreaPixels]);

  const handleCropCancel = useCallback(() => {
    setShowCropDialog(false);
    setOriginalImage(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
  }, []);

  // Helper function to create cropped image
  const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener("load", () => resolve(image));
      image.addEventListener("error", (error) => reject(error));
      image.setAttribute("crossOrigin", "anonymous");
      image.src = url;
    });

  const getCroppedImg = async (
    imageSrc: string,
    pixelCrop: any
  ): Promise<string> => {
    const image = await createImage(imageSrc);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      throw new Error("No 2d context");
    }

    // Calculate the size of the cropped area
    const { width, height } = pixelCrop;
    const size = Math.min(width, height);

    // Set canvas size to square
    canvas.width = size;
    canvas.height = size;

    // Calculate the center crop
    const sourceX = pixelCrop.x + (pixelCrop.width - size) / 2;
    const sourceY = pixelCrop.y + (pixelCrop.height - size) / 2;

    // Draw the cropped image
    ctx.drawImage(image, sourceX, sourceY, size, size, 0, 0, size, size);

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(URL.createObjectURL(blob));
        }
      }, "image/jpeg");
    });
  };

  // Dithering algorithm with retry mechanism
  const generateDitheredImage = useCallback(
    async (retryCount = 0) => {
      if (!image) return;

      setIsProcessing(true);

      try {
        const img = new Image();
        img.crossOrigin = "anonymous";

        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = image;
        });

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // Set canvas size
        canvas.width = 400;
        canvas.height = 400;

        // Draw and scale image
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Get image data
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // Convert to grayscale and create dither data
        const ditherData: number[][] = [];
        const cellHeight = Math.floor(canvas.height / gridSize);
        const cellWidth = Math.floor(canvas.width / gridSize);

        for (let y = 0; y < gridSize; y++) {
          const row: number[] = [];
          for (let x = 0; x < gridSize; x++) {
            let totalBrightness = 0;
            let pixelCount = 0;

            // Sample pixels in this grid cell
            for (
              let dy = 0;
              dy < cellHeight && y * cellHeight + dy < canvas.height;
              dy++
            ) {
              for (
                let dx = 0;
                dx < cellWidth && x * cellWidth + dx < canvas.width;
                dx++
              ) {
                const pixelIndex =
                  ((y * cellHeight + dy) * canvas.width +
                    (x * cellWidth + dx)) *
                  4;
                const r = data[pixelIndex];
                const g = data[pixelIndex + 1];
                const b = data[pixelIndex + 2];

                // Convert to grayscale using luminance formula
                const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
                totalBrightness += brightness;
                pixelCount++;
              }
            }

            const avgBrightness = totalBrightness / pixelCount;
            row.push(avgBrightness / 255); // Normalize to 0-1
          }
          ditherData.push(row);
        }

        // Wait for SVG to be available with better timing
        let attempts = 0;
        const maxAttempts = 20; // Increased attempts

        const waitForSVG = () => {
          return new Promise<void>((resolve) => {
            const checkSVG = () => {
              if (svgRef.current) {
                console.log("SVG found after", attempts, "attempts");
                resolve();
              } else if (attempts < maxAttempts) {
                attempts++;
                setTimeout(checkSVG, 100); // Increased delay
              } else {
                console.error(
                  "SVG ref not found after",
                  maxAttempts,
                  "attempts"
                );
                resolve();
              }
            };
            checkSVG();
          });
        };

        await waitForSVG();

        // Generate SVG
        const svg = svgRef.current;
        if (svg) {
          svg.innerHTML = "";
          console.log("SVG cleared, generating dots...", {
            ditherDataLength: ditherData.length,
          });

          const cellSize = 400 / gridSize;
          const dotRadius = Math.max(0.5, cellSize * 0.15);
          let totalDots = 0;

          for (let y = 0; y < ditherData.length; y++) {
            for (let x = 0; x < ditherData[y].length; x++) {
              const brightness = ditherData[y][x];

              // Improved dithering algorithm
              // Use threshold-based dithering for better quality
              const threshold = 0.5;
              const noise = (Math.random() - 0.5) * 0.1; // Small amount of noise
              const adjustedBrightness = Math.max(
                0,
                Math.min(1, brightness + noise)
              );

              // More sophisticated dot distribution
              const dotCount = Math.floor(adjustedBrightness * 8); // 0-8 dots per cell
              const dotDensity = Math.pow(adjustedBrightness, 0.7); // Non-linear density
              const dotSize = Math.max(
                0.3,
                dotRadius * (0.5 + dotDensity * 0.5)
              );

              // Create a grid pattern for more organized dots
              const gridSpacing = cellSize / 3;
              const startX = x * cellSize + gridSpacing;
              const startY = y * cellSize + gridSpacing;

              for (let i = 0; i < dotCount; i++) {
                const circle = document.createElementNS(
                  "http://www.w3.org/2000/svg",
                  "circle"
                );

                // Better dot positioning using grid + randomness
                let dotX, dotY;

                if (i < 4) {
                  // Place dots in a 2x2 grid pattern
                  const gridX = (i % 2) * gridSpacing;
                  const gridY = Math.floor(i / 2) * gridSpacing;
                  dotX = startX + gridX;
                  dotY = startY + gridY;
                } else {
                  // Random placement for additional dots
                  dotX =
                    x * cellSize +
                    cellSize / 2 +
                    (Math.random() - 0.5) * cellSize * 0.6;
                  dotY =
                    y * cellSize +
                    cellSize / 2 +
                    (Math.random() - 0.5) * cellSize * 0.6;
                }

                // Add subtle randomness
                const jitter = cellSize * 0.05;
                dotX += (Math.random() - 0.5) * jitter;
                dotY += (Math.random() - 0.5) * jitter;

                circle.setAttribute("cx", dotX.toString());
                circle.setAttribute("cy", dotY.toString());
                circle.setAttribute("r", dotSize.toString());
                circle.setAttribute("fill", "#000000");
                circle.setAttribute("class", "dither-dot");

                svg.appendChild(circle);
                totalDots++;
              }
            }
          }
          console.log("Generated dots:", totalDots);
        } else {
          console.error("SVG ref still not found after waiting");
          // Retry mechanism
          if (retryCount < 2) {
            console.log("Retrying dithering... attempt", retryCount + 1);
            setTimeout(() => {
              generateDitheredImage(retryCount + 1);
            }, 200);
            return;
          }
        }
      } catch (error) {
        console.error("Error processing image:", error);
        // Retry on error
        if (retryCount < 2) {
          console.log("Retrying due to error... attempt", retryCount + 1);
          setTimeout(() => {
            generateDitheredImage(retryCount + 1);
          }, 200);
          return;
        }
      } finally {
        setIsProcessing(false);
      }
    },
    [image, gridSize]
  );

  // Debounced dithering function
  const debouncedGenerateDitheredImage = useCallback(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = setTimeout(() => {
      if (image) {
        console.log("Generating dithered image (debounced)...", {
          gridSize,
          image: !!image,
        });
        generateDitheredImage();
      }
    }, 300); // 300ms debounce
  }, [image, gridSize, generateDitheredImage]);

  // Regenerate dither when image changes
  useEffect(() => {
    if (image) {
      debouncedGenerateDitheredImage();
    }
  }, [image, debouncedGenerateDitheredImage]);

  // Regenerate dither when grid size changes
  useEffect(() => {
    if (image) {
      debouncedGenerateDitheredImage();
    }
  }, [gridSize, debouncedGenerateDitheredImage]);

  // Export functions
  const handleExportPNG = useCallback(async () => {
    if (!svgRef.current) return;

    try {
      const { default: html2canvas } = await import("html2canvas");

      // Create a temporary container to ensure proper rendering
      const tempContainer = document.createElement("div");
      tempContainer.style.position = "absolute";
      tempContainer.style.left = "-9999px";
      tempContainer.style.top = "-9999px";
      tempContainer.style.width = "400px";
      tempContainer.style.height = "400px";
      tempContainer.style.backgroundColor = "#ffffff";

      // Clone the SVG
      const svgClone = svgRef.current.cloneNode(true) as SVGSVGElement;
      svgClone.style.width = "400px";
      svgClone.style.height = "400px";
      tempContainer.appendChild(svgClone);
      document.body.appendChild(tempContainer);

      const canvas = await html2canvas(tempContainer, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
        allowTaint: true,
        foreignObjectRendering: true,
        width: 400,
        height: 400,
      });

      // Clean up
      document.body.removeChild(tempContainer);

      const link = document.createElement("a");
      link.download = "dithered-image.png";
      link.href = canvas.toDataURL();
      link.click();
    } catch (error) {
      console.error("PNG export failed:", error);
    }
  }, []);

  const handleExportSVG = useCallback(() => {
    if (!svgRef.current) return;

    try {
      const svgData = new XMLSerializer().serializeToString(svgRef.current);
      const svgBlob = new Blob([svgData], {
        type: "image/svg+xml;charset=utf-8",
      });
      const svgUrl = URL.createObjectURL(svgBlob);

      const link = document.createElement("a");
      link.download = "dithered-image.svg";
      link.href = svgUrl;
      link.click();

      URL.revokeObjectURL(svgUrl);
    } catch (error) {
      console.error("SVG export failed:", error);
    }
  }, []);

  const handleCopyPNG = useCallback(async () => {
    if (!svgRef.current) return;

    try {
      const { default: html2canvas } = await import("html2canvas");

      // Create a temporary container to ensure proper rendering
      const tempContainer = document.createElement("div");
      tempContainer.style.position = "absolute";
      tempContainer.style.left = "-9999px";
      tempContainer.style.top = "-9999px";
      tempContainer.style.width = "400px";
      tempContainer.style.height = "400px";
      tempContainer.style.backgroundColor = "#ffffff";

      // Clone the SVG
      const svgClone = svgRef.current.cloneNode(true) as SVGSVGElement;
      svgClone.style.width = "400px";
      svgClone.style.height = "400px";
      tempContainer.appendChild(svgClone);
      document.body.appendChild(tempContainer);

      const canvas = await html2canvas(tempContainer, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
        allowTaint: true,
        foreignObjectRendering: true,
        width: 400,
        height: 400,
      });

      // Clean up
      document.body.removeChild(tempContainer);

      canvas.toBlob(async (blob) => {
        if (blob) {
          try {
            await navigator.clipboard.write([
              new ClipboardItem({ "image/png": blob }),
            ]);
          } catch (error) {
            console.error("Copy to clipboard failed:", error);
          }
        }
      }, "image/png");
    } catch (error) {
      console.error("PNG copy failed:", error);
    }
  }, []);

  const handleCopySVG = useCallback(async () => {
    if (!svgRef.current) return;

    try {
      const svgData = new XMLSerializer().serializeToString(svgRef.current);
      await navigator.clipboard.writeText(svgData);

      // Show checkmark feedback
      setIsCopied(true);
      setTimeout(() => {
        setIsCopied(false);
      }, 1000);
    } catch (error) {
      console.error("SVG copy failed:", error);
    }
  }, []);

  const handleViewSvgCode = useCallback(() => {
    if (!svgRef.current) return;

    try {
      const svgData = new XMLSerializer().serializeToString(svgRef.current);
      setSvgCode(svgData);
      setShowSvgCodeDialog(true);
    } catch (error) {
      console.error("Failed to get SVG code:", error);
    }
  }, []);

  return (
    <>
      <TargetCursor />
      <div className="min-h-screen bg-black text-white p-4">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Header */}
          <div className="text-center space-y-2 pt-10">
            <Shuffle
              text="Image Dithering (Experimental)"
              shuffleDirection="right"
              duration={0.35}
              animationMode="evenodd"
              shuffleTimes={1}
              ease="power3.out"
              stagger={0.03}
              threshold={0.1}
              triggerOnce={true}
              triggerOnHover={true}
              respectReducedMotion={true}
              onShuffleComplete={() => {}}
              colorFrom="#ffffff"
              colorTo="#ffffff"
              className="shuffler w-full text-center"
            />
            <p className="text-muted-foreground">
              Transform images into black and white dotted patterns
            </p>
          </div>

          {/* Upload Area */}
          <Card className="p-4 md:p-6 border-border">
            <div
              className={cn(
                "border-2 border-dashed border-white/20 rounded-lg p-8 text-center transition-colors",
                isDragOver ? "border-white/20 bg-muted/10" : "border-white/30"
              )}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {image ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-center space-x-2">
                    <ImageIcon className="w-5 h-5" />
                    <span>Image uploaded successfully</span>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setImage(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                  >
                    Load a Different Image
                  </Button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="space-y-4">
                    <Upload className="w-12 h-12 mx-auto text-muted-foreground" />
                    <div>
                      <p className="text-lg font-medium">
                        Drop your image here
                      </p>
                      <p className="text-muted-foreground">
                        or click to browse
                      </p>
                    </div>
                    <Button
                      onClick={() => fileInputRef.current?.click()}
                      className="bg-white text-black hover:bg-gray-100"
                    >
                      Choose File
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileInput}
                      className="hidden"
                    />
                  </div>

                  {/* Example Images */}
                  <div className="border-t border-white/10 pt-6">
                    <p className="text-sm text-muted-foreground mb-4">
                      Or try these examples:
                    </p>
                    <div className="grid grid-cols-4 gap-2">
                      {[1, 2, 3, 4, 5, 6, 7].map((num) => (
                        <button
                          key={num}
                          onClick={() => {
                            setOriginalImage(`/assets/example${num}.png`);
                            setShowCropDialog(true);
                          }}
                          className="aspect-square rounded-lg overflow-hidden border border-white/20 hover:border-white/40 transition-all duration-300 filter grayscale hover:grayscale-0 cursor-pointer"
                        >
                          <img
                            src={`/assets/example${num}.png`}
                            alt={`Example ${num}`}
                            className="w-full h-full object-cover hover:scale-120 transition-all duration-300"
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Controls */}
          {image && (
            <Card className="p-6 border-border">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Grid Complexity</label>
                  <div className="flex items-center space-x-2">
                    <Input
                      type="number"
                      value={gridSize}
                      onChange={(e) => {
                        const value = parseInt(e.target.value);
                        if (!isNaN(value) && value >= 16 && value <= 512) {
                          setGridSize(value);
                        }
                      }}
                      min={minGridSize}
                      max={maxGridSize}
                      className="w-20 h-8 text-center bg-black border-white/20 text-white"
                    />
                    <span className="text-muted-foreground text-sm">
                      ×{gridSize}
                    </span>
                  </div>
                </div>
                <Slider
                  value={[gridSize]}
                  onValueChange={(value) => setGridSize(value[0])}
                  min={minGridSize}
                  max={maxGridSize}
                  step={1}
                  className="w-full text-black rounded-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>
                    {minGridSize}×{minGridSize} (Blocky)
                  </span>
                  <span>
                    {maxGridSize}×{maxGridSize} (Detailed)
                  </span>
                </div>
              </div>
            </Card>
          )}

          {/* Preview Area */}
          {image && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Original Image */}
              <Card className="p-4 border-border">
                <h3 className="text-lg font-medium mb-4">Original</h3>
                <div className="aspect-square bg-muted/10 rounded-lg overflow-hidden">
                  <img
                    src={image}
                    alt="Original"
                    className="w-full h-full object-cover"
                  />
                </div>
              </Card>

              {/* Dithered Image */}
              <Card className="p-4 border-border">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium">Dithered</h3>
                  <div className="flex items-center space-x-2">
                    {/* Retry Button */}
                    {image && !isProcessing && (
                      <Button
                        onClick={() => {
                          if (image) {
                            debouncedGenerateDitheredImage();
                          }
                        }}
                        size="icon"
                        variant="ghost"
                        className="text-white hover:bg-white/10 cursor-pointer"
                      >
                        <RefreshCcw className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      onClick={handleViewSvgCode}
                      disabled={isProcessing}
                      size="sm"
                      variant="outline"
                      className="border-white/20 text-white hover:bg-white/10"
                    >
                      <Code className="w-4 h-4 mr-2" />
                      View SVG Code
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          disabled={isProcessing}
                          size="sm"
                          className="bg-white text-black hover:bg-gray-100"
                        >
                          Export
                          <ChevronDown className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="bg-black border-white/20">
                        <DropdownMenuItem
                          onClick={handleExportPNG}
                          className="text-white hover:bg-white/10 cursor-pointer"
                        >
                          <ImageIcon className="w-4 h-4" />
                          Download as PNG
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-white/20" />
                        <DropdownMenuItem
                          onClick={handleCopyPNG}
                          className="text-white hover:bg-white/10 cursor-pointer"
                        >
                          <Copy className="w-4 h-4" />
                          Copy as PNG
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                <div className="aspect-square bg-white rounded-lg overflow-hidden relative flex items-center justify-center">
                  {isProcessing ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
                    </div>
                  ) : (
                    <svg
                      ref={svgRef}
                      width="400"
                      height="400"
                      viewBox="0 0 400 400"
                      className="dither-svg w-full h-full"
                      style={{ backgroundColor: "#ffffff" }}
                      preserveAspectRatio="xMidYMid meet"
                    />
                  )}
                </div>
              </Card>
            </div>
          )}

          {/* Crop Dialog */}
          <Dialog open={showCropDialog} onOpenChange={setShowCropDialog}>
            <DialogContent className="max-w-4xl bg-black border-white/20">
              <DialogHeader>
                <DialogTitle className="flex items-center space-x-2 text-white">
                  <Crop className="w-5 h-5" />
                  <span>Crop Image to Square</span>
                </DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  Drag to reposition and use the slider to zoom. The crop area
                  will be forced to a square.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="relative h-96 bg-gray-900 rounded-lg overflow-hidden">
                  {originalImage && (
                    <Cropper
                      image={originalImage}
                      crop={crop}
                      zoom={zoom}
                      aspect={1}
                      onCropChange={setCrop}
                      onCropComplete={onCropComplete}
                      onZoomChange={setZoom}
                      showGrid={true}
                      style={{
                        containerStyle: {
                          width: "100%",
                          height: "100%",
                          position: "relative",
                        },
                      }}
                    />
                  )}
                </div>

                <div className="flex items-center space-x-4">
                  <label className="text-sm font-medium text-white">
                    Zoom:
                  </label>
                  <Slider
                    value={[zoom]}
                    onValueChange={(value) => setZoom(value[0])}
                    min={1}
                    max={3}
                    step={0.1}
                    className="flex-1"
                  />
                  <span className="text-sm text-muted-foreground">
                    {Math.round(zoom * 100)}%
                  </span>
                </div>

                <div className="flex justify-end space-x-2">
                  <Button
                    variant="outline"
                    onClick={handleCropCancel}
                    className="border-white/20 text-white hover:bg-white/10"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCropConfirm}
                    className="bg-white text-black hover:bg-gray-100"
                  >
                    <Crop className="w-4 h-4 mr-2" />
                    Crop & Continue
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* SVG Code Dialog */}
          <Dialog open={showSvgCodeDialog} onOpenChange={setShowSvgCodeDialog}>
            <DialogContent className="max-w-4xl bg-black border-white/20">
              <DialogHeader>
                <DialogTitle className="flex items-center space-x-2 text-white">
                  <Code className="w-5 h-5" />
                  <span>SVG Code</span>
                </DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  View and copy the generated SVG code for your dithered image.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="h-96 border border-white/20 rounded-lg overflow-hidden">
                  <Editor
                    height="100%"
                    defaultLanguage="xml"
                    value={svgCode}
                    theme="vs-dark"
                    options={{
                      readOnly: true,
                      minimap: { enabled: false },
                      scrollBeyondLastLine: false,
                      wordWrap: "on",
                      fontSize: 14,
                      lineNumbers: "on",
                      folding: true,
                      lineDecorationsWidth: 0,
                      lineNumbersMinChars: 3,
                    }}
                  />
                </div>

                <div className="flex justify-end space-x-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowSvgCodeDialog(false)}
                    className="border-white/20 text-white hover:bg-white/10"
                  >
                    Close
                  </Button>
                  <Button
                    onClick={handleCopySVG}
                    className="bg-white text-black hover:bg-gray-100"
                  >
                    {isCopied ? (
                      <Check className="w-4 h-4 mr-2" />
                    ) : (
                      <Copy className="w-4 h-4 mr-2" />
                    )}
                    {isCopied ? "Copied!" : "Copy SVG Code"}
                  </Button>
                  <Button
                    onClick={handleExportSVG}
                    className="bg-white text-black hover:bg-gray-100"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download as SVG
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </>
  );
}
