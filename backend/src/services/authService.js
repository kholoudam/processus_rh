import axios from "axios";

const API = "http://localhost:3000/api/auth";

export const login = (data) => {
  return axios.post(
    `${API}/login`,
    data
  );
};

export const getProfile = () => {
  return axios.get(
    `${API}/profile`,
    {
      headers: {
        Authorization:
          `Bearer ${localStorage.getItem("token")}`
      }
    }
  );
};