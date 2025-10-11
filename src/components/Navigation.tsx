interface NavigationProps {
  currentPage: number
  setCurrentPage: (page: number) => void
  totalPages: number
}

export default function Navigation({ currentPage, setCurrentPage, totalPages }: NavigationProps) {
  const handlePrevious = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1)
    }
  }

  const handleNext = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1)
    }
  }

  return (
    <div className="space-y-3">
      <div className="text-center text-gray-400">
        Slide <span className="text-white font-semibold">{currentPage}</span> / {totalPages}
      </div>

      <div className="flex gap-3">
        <button
          onClick={handlePrevious}
          disabled={currentPage === 1}
          className="flex-1 py-2 px-4 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors"
        >
          Previous
        </button>
        <button
          onClick={handleNext}
          disabled={currentPage === totalPages}
          className="flex-1 py-2 px-4 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  )
}
