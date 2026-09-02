module.exports = {
  useQuery: (options) => ({
    data: options?.queryKey?.[0] === 'visits' ? [] : null,
    isLoading: false,
    error: null,
    refetch: jest.fn(),
    isRefetching: false,
  }),
  useMutation: (options) => ({
    mutate: jest.fn(),
    mutateAsync: jest.fn(() => Promise.resolve({})),
    isPending: false,
    isSuccess: false,
    isError: false,
  }),
  useQueryClient: () => ({
    invalidateQueries: jest.fn(),
    setQueryData: jest.fn(),
    getQueryData: jest.fn(),
  }),
  QueryClient: jest.fn(),
  QueryClientProvider: ({ children }) => children,
};
