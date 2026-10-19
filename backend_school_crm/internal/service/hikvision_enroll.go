package service

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"image"
	"image/jpeg"
	_ "image/png" // register the PNG decoder
	"log"
	"strconv"
	"strings"

	"github.com/school-crm/backend/internal/models"
)

// Minimum face-photo size: terminals reject smaller pictures.
const minFacePhotoSide = 200

// NormalizeFacePhoto validates an uploaded face photo and returns JPEG bytes
// (PNG is converted; JPEG passes through untouched).
func NormalizeFacePhoto(data []byte) ([]byte, error) {
	if len(data) == 0 {
		return nil, errors.New("a face photo is required")
	}
	cfg, format, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil || (format != "jpeg" && format != "png") {
		return nil, errors.New("the photo must be a JPEG or PNG image")
	}
	if cfg.Width < minFacePhotoSide || cfg.Height < minFacePhotoSide {
		return nil, fmt.Errorf("the photo is too small (%dx%d): at least %dx%d pixels are needed", cfg.Width, cfg.Height, minFacePhotoSide, minFacePhotoSide)
	}
	if format == "jpeg" {
		return data, nil
	}
	img, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return nil, errors.New("the photo could not be read")
	}
	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, img, &jpeg.Options{Quality: 90}); err != nil {
		return nil, errors.New("the photo could not be converted to JPEG")
	}
	return buf.Bytes(), nil
}

// nextEmployeeNo draws the next number from a database sequence, so concurrent
// enrolments never get the same one.
func (s *HikvisionService) nextEmployeeNo(ctx context.Context) (string, error) {
	var n int64
	if err := s.db.GetConn().QueryRowContext(ctx, `SELECT nextval('hikvision_employee_no_seq')`).Scan(&n); err != nil {
		return "", err
	}
	return strconv.FormatInt(n, 10), nil
}

func isEmployeeNoCollision(err error) bool {
	if err == nil {
		return false
	}
	m := strings.ToLower(err.Error())
	return strings.Contains(m, "ccf038024") || strings.Contains(m, "already exist") || strings.Contains(m, "duplicate key")
}

// EnrollEmployee creates an employee with a generated number AND uploads the
// face in one step. A person without a face can never be recognised, so if the
// face is rejected the employee is removed again instead of being left half-created.
func (s *HikvisionService) EnrollEmployee(ctx context.Context, req *AddEmployeeRequest, photo []byte) (*models.HikvisionEmployee, error) {
	jpegData, err := NormalizeFacePhoto(photo)
	if err != nil {
		return nil, err
	}
	req.FullName = strings.TrimSpace(req.FullName)
	if req.FullName == "" {
		return nil, errors.New("full name is required")
	}

	var emp *models.HikvisionEmployee
	for attempt := 0; attempt < 5; attempt++ {
		no, err := s.nextEmployeeNo(ctx)
		if err != nil {
			return nil, err
		}
		var taken bool
		if err := s.db.GetConn().QueryRowContext(ctx,
			`SELECT EXISTS(SELECT 1 FROM hikvision_employees WHERE employee_no = $1)`, no).Scan(&taken); err != nil {
			return nil, err
		}
		if taken {
			continue // a hand-entered number from before generation existed
		}
		attemptReq := *req
		attemptReq.EmployeeNo = no
		created, err := s.AddEmployee(ctx, &attemptReq)
		if err != nil {
			if isEmployeeNoCollision(err) {
				continue
			}
			return nil, err
		}
		emp = created
		break
	}
	if emp == nil {
		return nil, errors.New("could not allocate a free employee number, please try again")
	}

	if err := s.UploadEmployeeFace(ctx, emp.ID, jpegData); err != nil {
		if rmErr := s.RemoveEmployee(ctx, emp.ID); rmErr != nil {
			log.Printf("hikvision: could not roll back employee %s after a failed face upload: %v", emp.ID, rmErr)
		}
		return nil, fmt.Errorf("the face photo was rejected (use a clear, front-facing photo): %w", err)
	}
	return s.GetEmployee(ctx, emp.ID)
}
