import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import BookCover from './BookCover';

afterEach(() => {
  cleanup();
});

describe('BookCover', () => {
  it('renders cover image and switches to styled fallback if image fails to load', () => {
    const { rerender } = render(
      <BookCover
        src="/upload/cover.webp"
        title="Clean Architecture"
        author="Robert C. Martin"
        category="Ilmu Komputer"
        size="md"
      />
    );

    const img = screen.getByAltText('Sampul Clean Architecture');
    expect(img).toHaveAttribute('src', '/upload/cover.webp');

    fireEvent.error(img);
    expect(screen.queryByAltText('Sampul Clean Architecture')).not.toBeInTheDocument();
    expect(screen.getByTitle('Clean Architecture oleh Robert C. Martin')).toBeInTheDocument();
    expect(screen.getByText('SIAPT UNAND')).toBeInTheDocument();

    // Changing src recovers image rendering
    rerender(
      <BookCover
        src="/upload/new-cover.webp"
        title="Clean Architecture"
        author="Robert C. Martin"
        category="Ilmu Komputer"
        size="sm"
      />
    );
    expect(screen.getByAltText('Sampul Clean Architecture')).toHaveAttribute(
      'src',
      '/upload/new-cover.webp'
    );
  });

  it('renders fallback without category/author/footer when size is sm', () => {
    render(
      <BookCover
        src=""
        title="Mini Book"
        author="Anonim"
        category="Kategori Lain"
        size="sm"
      />
    );
    expect(screen.getByTitle('Mini Book oleh Anonim')).toBeInTheDocument();
    expect(screen.queryByText('SIAPT UNAND')).not.toBeInTheDocument();
  });
});
