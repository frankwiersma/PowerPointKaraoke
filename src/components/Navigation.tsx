interface NavigationProps {
  currentPage: number
  setCurrentPage: (page: number) => void
  totalPages: number
}

export default function Navigation({ currentPage, setCurrentPage, totalPages }: NavigationProps) {
  const handleFirst = () => {
    setCurrentPage(1)
  }

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

  const handleLast = () => {
    setCurrentPage(totalPages)
  }

  const progress = (currentPage / totalPages) * 100

  return (
    <div className="space-y-2" style={{ padding: '0!important', margin: '0!important' }}>
      {/* Progress Bar */}
      <div className="relative">
        <div className="h-1.5 bg-gray-700/50 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 transition-all duration-500 ease-out relative overflow-hidden"
            style={{ width: `${progress}%` }}
          >
            {/* Animated shine effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse"></div>
          </div>
        </div>
      </div>

      {/* Page Counter */}
      <div
        className="rounded-lg p-2 text-center"
        style={{
          margin: '0!important',
          background: 'rgba(30, 41, 59, 0.6)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          border: '1px solid rgba(168, 85, 247, 0.2)'
        }}
      >
        <div className="flex items-center justify-center space-x-2" style={{ padding: '0!important', margin: '0!important' }}>
          <span className="text-xs text-gray-300">Slide</span>
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-pink-600 blur-lg opacity-50"></div>
            <span className="relative text-2xl font-bold gradient-text">
              {currentPage}
            </span>
          </div>
          <span className="text-sm text-gray-400 font-light">/</span>
          <span className="text-lg text-gray-300 font-semibold">{totalPages}</span>
        </div>

        {/* Percentage */}
        <div className="mt-1">
          <span className="text-xs text-gray-400 font-medium">
            {Math.round(progress)}% complete
          </span>
        </div>
      </div>

      {/* Navigation Buttons */}
      <div className="flex gap-1.5" style={{ padding: '0!important', margin: '0!important' }}>
        {/* First Button */}
        <button
          onClick={handleFirst}
          disabled={currentPage === 1}
          className={`
            group relative overflow-hidden rounded-lg py-2 px-2 font-semibold text-sm
            transition-all duration-300 transform
            ${currentPage === 1
              ? 'bg-gray-800/50 text-gray-600 cursor-not-allowed border border-gray-700/50'
              : 'glass-light text-white hover:scale-[1.02] hover:shadow-lg hover:shadow-purple-500/20 border border-gray-600 hover:border-purple-500/50'
            }
          `}
          title="First slide"
        >
          {currentPage !== 1 && (
            <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          )}
          <div className="relative" style={{ padding: '0!important', margin: '0!important' }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </div>
        </button>

        {/* Previous Button */}
        <button
          onClick={handlePrevious}
          disabled={currentPage === 1}
          className={`
            flex-1 group relative overflow-hidden rounded-lg py-2 px-3 font-semibold text-sm
            transition-all duration-300 transform
            ${currentPage === 1
              ? 'bg-gray-800/50 text-gray-600 cursor-not-allowed border border-gray-700/50'
              : 'glass-light text-white hover:scale-[1.02] hover:shadow-xl hover:shadow-purple-500/20 border border-gray-600 hover:border-purple-500/50'
            }
          `}
        >
          {currentPage !== 1 && (
            <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          )}
          <div className="relative flex items-center justify-center space-x-1" style={{ padding: '0!important', margin: '0!important' }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span>Previous</span>
          </div>
        </button>

        {/* Next Button */}
        <button
          onClick={handleNext}
          disabled={currentPage === totalPages}
          className={`
            flex-1 group relative overflow-hidden rounded-lg py-2 px-3 font-semibold text-sm
            transition-all duration-300 transform
            ${currentPage === totalPages
              ? 'bg-gray-800/50 text-gray-600 cursor-not-allowed border border-gray-700/50'
              : 'glass-light text-white hover:scale-[1.02] hover:shadow-xl hover:shadow-pink-500/20 border border-gray-600 hover:border-pink-500/50'
            }
          `}
        >
          {currentPage !== totalPages && (
            <div className="absolute inset-0 bg-gradient-to-l from-pink-600/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          )}
          <div className="relative flex items-center justify-center space-x-1" style={{ padding: '0!important', margin: '0!important' }}>
            <span>Next</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </button>

        {/* Last Button */}
        <button
          onClick={handleLast}
          disabled={currentPage === totalPages}
          className={`
            group relative overflow-hidden rounded-lg py-2 px-2 font-semibold text-sm
            transition-all duration-300 transform
            ${currentPage === totalPages
              ? 'bg-gray-800/50 text-gray-600 cursor-not-allowed border border-gray-700/50'
              : 'glass-light text-white hover:scale-[1.02] hover:shadow-lg hover:shadow-pink-500/20 border border-gray-600 hover:border-pink-500/50'
            }
          `}
          title="Last slide"
        >
          {currentPage !== totalPages && (
            <div className="absolute inset-0 bg-gradient-to-l from-pink-600/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          )}
          <div className="relative" style={{ padding: '0!important', margin: '0!important' }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
          </div>
        </button>
      </div>
    </div>
  )
}
