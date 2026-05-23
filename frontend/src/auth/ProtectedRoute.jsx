import { Navigate } from 'react-router-dom'

const ProtectedRoute = ({ children }) => {
    const auth = localStorage.getItem('neuralbi_auth')
    if (!auth) return <Navigate to="/login" replace />
    try {
        JSON.parse(auth)
        return children
    } catch {
        localStorage.removeItem('neuralbi_auth')
        return <Navigate to="/login" replace />
    }
}

export default ProtectedRoute
