import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ChapterPanel from '../src/terminal/views/manifesto/ChapterPanel';

const CHAPTER = {
  id: 'substrate',
  number: '§1',
  title: 'THE SUBSTRATE',
  epigraph: '34 kernels. Each one a .rs file compiled to WebAssembly.',
  opening: 'First sentence here. Second sentence here. Third sentence.',
};

describe('ChapterPanel', () => {
  it('renders chapter number, title and epigraph', () => {
    render(<ChapterPanel chapter={CHAPTER} chapterIndex={0} onClose={() => {}} />);
    expect(screen.getByText('§1')).toBeInTheDocument();
    expect(screen.getByText('THE SUBSTRATE')).toBeInTheDocument();
    expect(screen.getByText(CHAPTER.epigraph)).toBeInTheDocument();
  });

  it('renders all opening sentences', () => {
    render(<ChapterPanel chapter={CHAPTER} chapterIndex={0} onClose={() => {}} />);
    expect(screen.getByText(/First sentence here/)).toBeInTheDocument();
    expect(screen.getByText(/Second sentence here/)).toBeInTheDocument();
  });

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn();
    render(<ChapterPanel chapter={CHAPTER} chapterIndex={0} onClose={onClose} />);
    fireEvent.click(screen.getByTestId('chapter-panel-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn();
    render(<ChapterPanel chapter={CHAPTER} chapterIndex={0} onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(<ChapterPanel chapter={CHAPTER} chapterIndex={0} onClose={onClose} />);
    fireEvent.click(screen.getByTestId('chapter-panel-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
